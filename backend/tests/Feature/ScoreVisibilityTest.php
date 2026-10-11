<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SignsInAsAdmin;
use Tests\TestCase;

class ScoreVisibilityTest extends TestCase
{
    use RefreshDatabase, SignsInAsAdmin;

    private function makeSubmitted(bool $showScore, string $status = 'submitted'): ExamSession
    {
        $exam = Exam::create([
            'title' => 'Quiz', 'duration_minutes' => 30, 'max_violations' => 3,
            'status' => Exam::STATUS_PUBLISHED, 'show_score' => $showScore,
        ]);
        $mc = $exam->questions()->create([
            'position' => 1, 'type' => 'multiple_choice', 'prompt' => 'Capital?',
            'options' => ['Manila', 'Cebu'], 'correct_answer' => 'Manila', 'required' => true,
        ]);
        $exam->questions()->create([
            'position' => 2, 'type' => 'multiple_choice', 'prompt' => 'Largest?',
            'options' => ['Luzon', 'Cebu'], 'correct_answer' => 'Luzon', 'required' => true,
        ]);
        $exam->questions()->create([
            'position' => 3, 'type' => 'paragraph', 'prompt' => 'Explain', 'required' => false,
        ]);

        $session = $exam->sessions()->create([
            'student_name' => 'Ana', 'student_number' => '2024-001', 'status' => $status,
            'started_at' => now()->subMinutes(10), 'expires_at' => now()->addMinutes(20),
            'submitted_at' => $status === 'in_progress' ? null : now(),
        ]);
        $session->answers()->create(['question_id' => $mc->id, 'value' => 'Manila']);

        return $session;
    }

    public function test_score_is_hidden_by_default(): void
    {
        $session = $this->makeSubmitted(false);

        $response = $this->getJson("/api/sessions/{$session->id}/result")->assertOk();

        $response->assertJson(['show_score' => false, 'score' => null]);
        $this->assertStringNotContainsString('earned', $response->getContent());
    }

    public function test_score_is_returned_when_enabled_without_the_key(): void
    {
        $session = $this->makeSubmitted(true);

        $response = $this->getJson("/api/sessions/{$session->id}/result")->assertOk();

        $response->assertJson([
            'show_score' => true,
            'score' => ['earned' => 1, 'total' => 2, 'percent' => 50, 'ungraded' => 1],
        ]);
        $this->assertStringNotContainsString('correct_answer', $response->getContent());
        $this->assertStringNotContainsString('results', $response->getContent());
    }

    public function test_auto_submitted_attempts_get_a_score_too(): void
    {
        $session = $this->makeSubmitted(true, 'auto_submitted');

        $this->getJson("/api/sessions/{$session->id}/result")
            ->assertOk()
            ->assertJsonPath('score.earned', 1);
    }

    public function test_no_score_while_the_attempt_is_in_progress(): void
    {
        $session = $this->makeSubmitted(true, 'in_progress');

        $this->getJson("/api/sessions/{$session->id}/result")->assertStatus(409);
    }

    public function test_exam_without_an_answer_key_has_no_score(): void
    {
        $session = $this->makeSubmitted(true);
        $session->exam->questions()->update(['correct_answer' => null]);

        $this->getJson("/api/sessions/{$session->id}/result")
            ->assertOk()
            ->assertJson(['show_score' => true, 'score' => null]);
    }

    public function test_toggle_needs_a_token_and_a_boolean(): void
    {
        $session = $this->makeSubmitted(false);
        $exam = $session->exam;

        $this->patchJson("/api/exams/{$exam->id}/score-visibility", ['show_score' => true])
            ->assertUnauthorized();

        $this->signInAsAdmin();

        $this->patchJson("/api/exams/{$exam->id}/score-visibility", [])->assertUnprocessable();
        $this->patchJson("/api/exams/{$exam->id}/score-visibility", ['show_score' => 'maybe'])
            ->assertUnprocessable();
    }

    public function test_teacher_can_turn_it_on_and_off_any_time(): void
    {
        $this->signInAsAdmin();
        $session = $this->makeSubmitted(false); // exam is published
        $exam = $session->exam;

        $this->patchJson("/api/exams/{$exam->id}/score-visibility", ['show_score' => true])
            ->assertOk()
            ->assertJsonPath('show_score', true);
        $this->getJson("/api/sessions/{$session->id}/result")->assertJsonPath('show_score', true);

        $this->patchJson("/api/exams/{$exam->id}/score-visibility", ['show_score' => false])
            ->assertOk()
            ->assertJsonPath('show_score', false);
        $this->getJson("/api/sessions/{$session->id}/result")->assertJsonPath('score', null);
    }
}