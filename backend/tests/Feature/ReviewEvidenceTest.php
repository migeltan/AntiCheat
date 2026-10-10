<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReviewEvidenceTest extends TestCase
{
    use RefreshDatabase;

    private function startedSession(int $maxViolations = 3): ExamSession
    {
        $exam = Exam::create([
            'title' => 'Quiz', 'duration_minutes' => 30,
            'max_violations' => $maxViolations, 'status' => Exam::STATUS_PUBLISHED,
        ]);

        return $exam->sessions()->create([
            'student_name' => 'Ana', 'student_number' => '2024-001', 'status' => 'in_progress',
            'started_at' => now(), 'expires_at' => now()->addMinutes(30),
        ]);
    }

    public function test_violation_response_reveals_nothing_to_the_student(): void
    {
        $session = $this->startedSession();

        $this->postJson("/api/sessions/{$session->id}/violations", ['type' => 'tab_switch'])
            ->assertCreated()
            ->assertExactJson(['recorded' => true]);

        $this->assertSame(1, $session->violations()->count());
    }

    public function test_summary_flags_students_who_reach_the_threshold(): void
    {
        $session = $this->startedSession(maxViolations: 2);
        $url = "/api/exams/{$session->exam_id}/summary";

        $session->violations()->create(['type' => 'tab_switch', 'severity' => 'medium']);
        $this->getJson($url)
            ->assertJsonPath('students.0.needs_review', false)
            ->assertJsonPath('totals.needs_review', 0);

        $session->violations()->create(['type' => 'window_blur', 'severity' => 'medium']);
        $this->getJson($url)
            ->assertJsonPath('students.0.needs_review', true)
            ->assertJsonPath('totals.needs_review', 1);
    }

    public function test_admin_routes_are_open_when_no_key_is_configured(): void
    {
        config(['anticheat.admin_key' => null]);

        $this->getJson('/api/exams')->assertOk();
    }

    public function test_admin_routes_require_the_key_when_configured(): void
    {
        config(['anticheat.admin_key' => 'secret']);

        $this->getJson('/api/exams')->assertUnauthorized();
        $this->withToken('wrong')->getJson('/api/exams')->assertUnauthorized();
        $this->withToken('secret')->getJson('/api/exams')->assertOk();
    }

    public function test_student_routes_never_need_the_key(): void
    {
        config(['anticheat.admin_key' => 'secret']);

        $this->getJson('/api/exams/code/NOPE12')->assertNotFound();
    }
}