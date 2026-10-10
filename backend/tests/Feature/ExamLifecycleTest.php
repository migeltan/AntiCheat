<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExamLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private function exam(string $status = Exam::STATUS_DRAFT, bool $withQuestion = true): Exam
    {
        $exam = Exam::create(['title' => 'Quiz', 'duration_minutes' => 30, 'status' => $status]);

        if ($withQuestion) {
            $exam->questions()->create([
                'position' => 1, 'type' => 'short_answer', 'prompt' => 'Q1', 'required' => true,
            ]);
        }

        return $exam;
    }

    private function session(Exam $exam): ExamSession
    {
        return $exam->sessions()->create([
            'student_name' => 'Ana', 'student_number' => '2024-001', 'status' => 'in_progress',
            'started_at' => now(), 'expires_at' => now()->addMinutes(30),
        ]);
    }

    private function questionPayload(): array
    {
        return ['questions' => [['type' => 'short_answer', 'prompt' => 'New Q']]];
    }

    public function test_new_exams_are_always_drafts(): void
    {
        $this->postJson('/api/exams', ['title' => 'Quiz', 'duration_minutes' => 30, 'status' => 'published'])
            ->assertCreated()
            ->assertJsonPath('status', 'draft');
    }

    public function test_cannot_publish_without_questions(): void
    {
        $exam = $this->exam(withQuestion: false);

        $this->patchJson("/api/exams/{$exam->id}/publish")->assertStatus(422);
        $this->assertSame('draft', $exam->fresh()->status);
    }

    public function test_publish_close_and_reopen(): void
    {
        $exam = $this->exam();

        $this->patchJson("/api/exams/{$exam->id}/publish")->assertOk()->assertJsonPath('status', 'published');
        $this->patchJson("/api/exams/{$exam->id}/close")->assertOk()->assertJsonPath('status', 'closed');
        $this->patchJson("/api/exams/{$exam->id}/publish")->assertOk()->assertJsonPath('status', 'published');
    }

    public function test_draft_cannot_be_closed(): void
    {
        $exam = $this->exam();

        $this->patchJson("/api/exams/{$exam->id}/close")->assertStatus(409);
    }

    public function test_draft_code_is_rejected(): void
    {
        $exam = $this->exam();
        $student = ['student_name' => 'Ana', 'student_number' => '2024-001'];

        $this->getJson("/api/exams/code/{$exam->exam_code}")->assertNotFound();
        $this->postJson("/api/exams/code/{$exam->exam_code}/sessions", $student)->assertNotFound();
    }

    public function test_closed_exam_rejects_new_students_but_code_still_resolves(): void
    {
        $exam = $this->exam(Exam::STATUS_CLOSED);

        $this->getJson("/api/exams/code/{$exam->exam_code}")->assertOk();
        $this->postJson("/api/exams/code/{$exam->exam_code}/sessions", [
            'student_name' => 'Ben', 'student_number' => '2024-002',
        ])->assertStatus(409);
    }

    public function test_in_progress_student_can_resume_save_and_submit_after_close(): void
    {
        $exam = $this->exam(Exam::STATUS_CLOSED);
        $session = $this->session($exam);
        $questionId = $exam->questions()->value('id');

        $this->postJson("/api/exams/code/{$exam->exam_code}/sessions", [
            'student_name' => 'Ana', 'student_number' => '2024-001',
        ])->assertOk()->assertJsonPath('id', $session->id);

        $this->getJson("/api/sessions/{$session->id}/questions")->assertOk();
        $this->putJson("/api/sessions/{$session->id}/answers", [
            'answers' => [['question_id' => $questionId, 'value' => 'hello']],
        ])->assertOk();
        $this->postJson("/api/sessions/{$session->id}/submit", ['reason' => 'manual'])
            ->assertOk()
            ->assertJsonPath('status', 'submitted');
    }

    public function test_questions_can_only_be_imported_while_draft(): void
    {
        $draft = $this->exam(withQuestion: false);
        $published = $this->exam(Exam::STATUS_PUBLISHED);

        $this->postJson("/api/exams/{$draft->id}/questions", $this->questionPayload())->assertCreated();
        $this->postJson("/api/exams/{$published->id}/questions", $this->questionPayload())->assertStatus(409);
    }
}