<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SignsInAsAdmin;
use Tests\TestCase;

class ReviewEvidenceTest extends TestCase
{
    use RefreshDatabase, SignsInAsAdmin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signInAsAdmin();
    }

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

}