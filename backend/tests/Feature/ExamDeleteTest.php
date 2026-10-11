<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamSession;
use App\Models\Violation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SignsInAsAdmin;
use Tests\TestCase;

class ExamDeleteTest extends TestCase
{
    use RefreshDatabase, SignsInAsAdmin;

    private function makeExam(string $status): Exam
    {
        $exam = Exam::create([
            'title' => 'Quiz', 'duration_minutes' => 30, 'max_violations' => 3, 'status' => $status,
        ]);
        $exam->questions()->create([
            'position' => 1, 'type' => 'short_answer', 'prompt' => 'Name?', 'required' => false,
        ]);

        return $exam;
    }

    public function test_deleting_needs_a_token(): void
    {
        $exam = $this->makeExam(Exam::STATUS_DRAFT);

        $this->deleteJson("/api/exams/{$exam->id}")->assertUnauthorized();
        $this->assertDatabaseHas('exams', ['id' => $exam->id]);
    }

    public function test_a_draft_can_be_deleted_with_its_questions(): void
    {
        $this->signInAsAdmin();
        $exam = $this->makeExam(Exam::STATUS_DRAFT);

        $this->deleteJson("/api/exams/{$exam->id}")->assertOk();

        $this->assertDatabaseMissing('exams', ['id' => $exam->id]);
        $this->assertDatabaseCount('questions', 0);
    }

    public function test_a_closed_exam_is_deleted_with_attempts_answers_and_violations(): void
    {
        $this->signInAsAdmin();
        $exam = $this->makeExam(Exam::STATUS_CLOSED);
        $session = $exam->sessions()->create([
            'student_name' => 'Ana', 'student_number' => '2024-001', 'status' => 'submitted',
            'started_at' => now()->subHour(), 'expires_at' => now()->subMinutes(30),
            'submitted_at' => now()->subMinutes(40),
        ]);
        $session->answers()->create(['question_id' => $exam->questions()->first()->id, 'value' => 'Ana']);
        $session->violations()->create(['type' => 'tab_switch', 'severity' => 'medium']);

        $this->deleteJson("/api/exams/{$exam->id}")->assertOk();

        $this->assertSame(0, ExamSession::count());
        $this->assertSame(0, Violation::count());
        $this->assertDatabaseCount('answers', 0);
    }

    public function test_a_published_exam_must_be_closed_first(): void
    {
        $this->signInAsAdmin();
        $exam = $this->makeExam(Exam::STATUS_PUBLISHED);

        $this->deleteJson("/api/exams/{$exam->id}")->assertStatus(409);
        $this->assertDatabaseHas('exams', ['id' => $exam->id]);
    }

    public function test_a_deleted_exam_code_no_longer_works(): void
    {
        $this->signInAsAdmin();
        $exam = $this->makeExam(Exam::STATUS_CLOSED);
        $code = $exam->exam_code;

        $this->deleteJson("/api/exams/{$exam->id}")->assertOk();

        $this->getJson("/api/exams/code/{$code}")->assertNotFound();
    }
}