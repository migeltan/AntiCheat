<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SignsInAsAdmin;
use Tests\TestCase;

class AnswerKeyTest extends TestCase
{
    use RefreshDatabase, SignsInAsAdmin;

    private function makeExam(string $status = Exam::STATUS_DRAFT): array
    {
        $exam = Exam::create([
            'title' => 'Quiz', 'duration_minutes' => 30,
            'max_violations' => 3, 'status' => $status,
        ]);

        $mc = $exam->questions()->create([
            'position' => 1, 'type' => 'multiple_choice', 'prompt' => 'Capital?',
            'options' => ['Manila', 'Cebu', 'Davao'], 'required' => true,
        ]);
        $cb = $exam->questions()->create([
            'position' => 2, 'type' => 'checkboxes', 'prompt' => 'Islands?',
            'options' => ['Luzon', 'Visayas', 'Mindanao', 'Borneo'], 'required' => true,
        ]);
        $text = $exam->questions()->create([
            'position' => 3, 'type' => 'short_answer', 'prompt' => 'Why?',
            'options' => null, 'required' => false,
        ]);

        return [$exam, $mc, $cb, $text];
    }

    private function makeSession(Exam $exam): ExamSession
    {
        return $exam->sessions()->create([
            'student_name' => 'Ana', 'student_number' => '2024-001', 'status' => 'in_progress',
            'started_at' => now(), 'expires_at' => now()->addMinutes(30),
        ]);
    }

    public function test_answer_key_requires_a_token(): void
    {
        [$exam] = $this->makeExam();

        $this->putJson("/api/exams/{$exam->id}/answer-key", ['key' => []])->assertUnauthorized();
    }

    public function test_admin_can_save_and_read_the_key(): void
    {
        $this->signInAsAdmin();
        [$exam, $mc, $cb] = $this->makeExam();

        $this->putJson("/api/exams/{$exam->id}/answer-key", [
            'key' => [$mc->id => 'Manila', $cb->id => ['Luzon', 'Visayas']],
        ])->assertOk();

        $this->assertSame('Manila', $mc->fresh()->correct_answer);
        $this->assertSame(['Luzon', 'Visayas'], $cb->fresh()->correct_answer);

        $list = $this->getJson("/api/exams/{$exam->id}/questions")->assertOk();
        $this->assertSame('Manila', $list->json('0.correct_answer'));
    }

    public function test_key_can_be_cleared(): void
    {
        $this->signInAsAdmin();
        [$exam, $mc] = $this->makeExam();
        $mc->update(['correct_answer' => 'Manila']);

        $this->putJson("/api/exams/{$exam->id}/answer-key", ['key' => [$mc->id => null]])->assertOk();

        $this->assertNull($mc->fresh()->correct_answer);
    }

    public function test_key_is_validated(): void
    {
        $this->signInAsAdmin();
        [$exam, $mc, $cb, $text] = $this->makeExam();

        // not one of the options
        $this->putJson("/api/exams/{$exam->id}/answer-key", ['key' => [$mc->id => 'Baguio']])
            ->assertUnprocessable();
        // multiple choice needs exactly one
        $this->putJson("/api/exams/{$exam->id}/answer-key", ['key' => [$mc->id => ['Manila', 'Cebu']]])
            ->assertUnprocessable();
        // text questions cannot have a key
        $this->putJson("/api/exams/{$exam->id}/answer-key", ['key' => [$text->id => 'x']])
            ->assertUnprocessable();
        // question of another exam
        [, $otherMc] = $this->makeExam();
        $this->putJson("/api/exams/{$exam->id}/answer-key", ['key' => [$otherMc->id => 'Manila']])
            ->assertUnprocessable();

        $this->assertNull($mc->fresh()->correct_answer);
    }

    public function test_key_is_locked_once_the_exam_is_not_a_draft(): void
    {
        $this->signInAsAdmin();
        [$exam, $mc] = $this->makeExam(Exam::STATUS_PUBLISHED);

        $this->putJson("/api/exams/{$exam->id}/answer-key", ['key' => [$mc->id => 'Manila']])
            ->assertStatus(409);
    }

    public function test_the_key_never_reaches_student_routes(): void
    {
        [$exam, $mc, $cb] = $this->makeExam(Exam::STATUS_PUBLISHED);
        $mc->update(['correct_answer' => 'Manila']);
        $cb->update(['correct_answer' => ['Luzon']]);
        $session = $this->makeSession($exam);

        $response = $this->getJson("/api/sessions/{$session->id}/questions")->assertOk();

        $this->assertStringNotContainsString('correct_answer', $response->getContent());
    }

    public function test_session_review_scores_choice_questions_only(): void
    {
        $this->signInAsAdmin();
        [$exam, $mc, $cb, $text] = $this->makeExam(Exam::STATUS_PUBLISHED);
        $mc->update(['correct_answer' => 'Manila']);
        $cb->update(['correct_answer' => ['Luzon', 'Visayas']]);
        $session = $this->makeSession($exam);

        $session->answers()->create(['question_id' => $mc->id, 'value' => 'Manila']);
        // missing one box: all-or-nothing, so wrong
        $session->answers()->create(['question_id' => $cb->id, 'value' => ['Luzon']]);
        $session->answers()->create(['question_id' => $text->id, 'value' => 'Because']);

        $score = $this->getJson("/api/admin/sessions/{$session->id}")->assertOk()->json('score');

        $this->assertSame(1, $score['earned']);
        $this->assertSame(2, $score['total']);
        $this->assertSame(50, $score['percent']);
        $this->assertSame(1, $score['ungraded']);
        $this->assertTrue($score['results'][$mc->id]);
        $this->assertFalse($score['results'][$cb->id]);
        $this->assertArrayNotHasKey($text->id, $score['results']);
    }

    public function test_checkbox_order_does_not_matter_and_blank_is_wrong(): void
    {
        $this->signInAsAdmin();
        [$exam, $mc, $cb] = $this->makeExam(Exam::STATUS_PUBLISHED);
        $mc->update(['correct_answer' => 'Manila']);
        $cb->update(['correct_answer' => ['Luzon', 'Visayas']]);
        $session = $this->makeSession($exam);

        $session->answers()->create(['question_id' => $cb->id, 'value' => ['Visayas', 'Luzon']]);

        $score = $this->getJson("/api/admin/sessions/{$session->id}")->json('score');

        $this->assertTrue($score['results'][$cb->id]);
        $this->assertFalse($score['results'][$mc->id]); // never answered
    }

    public function test_exam_without_a_key_reports_no_score(): void
    {
        $this->signInAsAdmin();
        [$exam] = $this->makeExam(Exam::STATUS_PUBLISHED);
        $session = $this->makeSession($exam);

        $score = $this->getJson("/api/admin/sessions/{$session->id}")->json('score');

        $this->assertSame(0, $score['total']);
        $this->assertNull($score['percent']);
        $this->assertSame(3, $score['ungraded']);
    }
}