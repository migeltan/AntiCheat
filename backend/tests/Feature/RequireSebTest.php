<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RequireSebTest extends TestCase
{
    use RefreshDatabase;

    private const SEB_AGENT = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 SEB/3.10.2';

    private function makeExam(bool $requireSeb): Exam
    {
        $exam = Exam::create([
            'title' => 'Quiz', 'duration_minutes' => 30, 'max_violations' => 3,
            'status' => Exam::STATUS_PUBLISHED, 'require_seb' => $requireSeb,
        ]);
        $exam->questions()->create([
            'position' => 1, 'type' => 'short_answer', 'prompt' => 'Name?', 'required' => false,
        ]);

        return $exam;
    }

    private function makeSession(Exam $exam): ExamSession
    {
        return $exam->sessions()->create([
            'student_name' => 'Ana', 'student_number' => '2024-001', 'status' => 'in_progress',
            'started_at' => now(), 'expires_at' => now()->addMinutes(30),
        ]);
    }

    private function startBody(): array
    {
        return ['student_name' => 'Ana', 'student_number' => '2024-001', 'consent' => true];
    }

    public function test_exam_without_lockdown_works_in_any_browser(): void
    {
        $exam = $this->makeExam(false);

        $this->postJson("/api/exams/code/{$exam->exam_code}/sessions", $this->startBody())
            ->assertCreated();
    }

    public function test_exam_code_lookup_stays_open_and_reports_the_requirement(): void
    {
        $exam = $this->makeExam(true);

        $this->getJson("/api/exams/code/{$exam->exam_code}")
            ->assertOk()
            ->assertJsonPath('require_seb', true);
    }

    public function test_starting_outside_seb_is_refused(): void
    {
        $exam = $this->makeExam(true);

        $this->postJson("/api/exams/code/{$exam->exam_code}/sessions", $this->startBody())
            ->assertForbidden()
            ->assertJsonPath('code', 'seb_required');

        $this->assertSame(0, $exam->sessions()->count());
    }

    public function test_starting_inside_seb_is_allowed(): void
    {
        $exam = $this->makeExam(true);

        $this->withHeaders(['User-Agent' => self::SEB_AGENT])
            ->postJson("/api/exams/code/{$exam->exam_code}/sessions", $this->startBody())
            ->assertCreated();
    }

    public function test_session_routes_are_refused_outside_seb(): void
    {
        $session = $this->makeSession($this->makeExam(true));
        $id = $session->id;

        $this->getJson("/api/sessions/{$id}")->assertForbidden();
        $this->getJson("/api/sessions/{$id}/questions")->assertForbidden();
        $this->getJson("/api/sessions/{$id}/answers")->assertForbidden();
        $this->putJson("/api/sessions/{$id}/answers", ['answers' => []])->assertForbidden();
        $this->postJson("/api/sessions/{$id}/violations", ['type' => 'tab_switch'])->assertForbidden();
        $this->postJson("/api/sessions/{$id}/submit")->assertForbidden();
        $this->getJson("/api/sessions/{$id}/result")->assertForbidden();

        $this->assertSame('in_progress', $session->fresh()->status);
        $this->assertSame(0, $session->violations()->count());
    }

    public function test_session_routes_work_inside_seb(): void
    {
        $session = $this->makeSession($this->makeExam(true));

        $this->withHeaders(['User-Agent' => self::SEB_AGENT])
            ->getJson("/api/sessions/{$session->id}/questions")
            ->assertOk();
    }

    public function test_session_routes_stay_open_for_exams_without_lockdown(): void
    {
        $session = $this->makeSession($this->makeExam(false));

        $this->getJson("/api/sessions/{$session->id}/questions")->assertOk();
    }

    public function test_unknown_session_is_still_a_404(): void
    {
        $this->getJson('/api/sessions/999999/questions')->assertNotFound();
    }
}