<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamSession;
use App\Models\Violation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TierOneHardeningTest extends TestCase
{
    use RefreshDatabase;

    private function publishedExam(): Exam
    {
        return Exam::create([
            'title' => 'Quiz', 'duration_minutes' => 30,
            'max_violations' => 3, 'status' => Exam::STATUS_PUBLISHED,
        ]);
    }

    public function test_start_requires_consent(): void
    {
        $exam = $this->publishedExam();
        $student = ['student_name' => 'Ana', 'student_number' => '2024-001'];

        $this->postJson("/api/exams/code/{$exam->exam_code}/sessions", $student)
            ->assertStatus(422)
            ->assertJsonValidationErrors('consent');

        $this->postJson("/api/exams/code/{$exam->exam_code}/sessions", $student + ['consent' => false])
            ->assertStatus(422);

        $this->assertSame(0, ExamSession::count());
    }

    public function test_start_with_consent_stores_consented_at(): void
    {
        $exam = $this->publishedExam();

        $this->postJson("/api/exams/code/{$exam->exam_code}/sessions", [
            'student_name' => 'Ana', 'student_number' => '2024-001', 'consent' => true,
        ])->assertCreated();

        $this->assertNotNull(ExamSession::first()->consented_at);
    }

    public function test_new_violation_types_are_recorded_with_their_severity(): void
    {
        $exam = $this->publishedExam();
        $session = $exam->sessions()->create([
            'student_name' => 'Ana', 'student_number' => '2024-001', 'status' => 'in_progress',
            'started_at' => now(), 'expires_at' => now()->addMinutes(30),
        ]);

        $expected = [
            'fullscreen_exit' => 'medium',
            'paste_attempt' => 'medium',
            'copy_attempt' => 'low',
            'mouse_left' => 'low',
        ];

        foreach ($expected as $type => $severity) {
            $this->postJson("/api/sessions/{$session->id}/violations", ['type' => $type])
                ->assertCreated()
                ->assertExactJson(['recorded' => true]);

            $this->assertDatabaseHas('violations', [
                'exam_session_id' => $session->id, 'type' => $type, 'severity' => $severity,
            ]);
        }

        $this->assertSame(array_keys($expected), array_values(array_intersect(array_keys(Violation::TYPES), array_keys($expected))));
    }
}