<?php

namespace Tests\Feature;

use App\Models\Exam;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SignsInAsAdmin;
use Tests\TestCase;

class ExamSebTest extends TestCase
{
    use RefreshDatabase, SignsInAsAdmin;

    private function makeExam(array $overrides = []): Exam
    {
        return Exam::create([
            'title' => 'Quiz', 'duration_minutes' => 30, 'max_violations' => 3,
            'status' => Exam::STATUS_DRAFT, ...$overrides,
        ]);
    }

    public function test_lockdown_is_off_by_default(): void
    {
        $this->signInAsAdmin();

        $this->postJson('/api/exams', ['title' => 'Quiz', 'duration_minutes' => 30])
            ->assertCreated()
            ->assertJsonPath('require_seb', false);
    }

    public function test_exam_can_be_created_with_lockdown_on(): void
    {
        $this->signInAsAdmin();

        $this->postJson('/api/exams', ['title' => 'Quiz', 'duration_minutes' => 30, 'require_seb' => true])
            ->assertCreated()
            ->assertJsonPath('require_seb', true);
    }

    public function test_setting_needs_a_token_and_a_boolean(): void
    {
        $exam = $this->makeExam();

        $this->patchJson("/api/exams/{$exam->id}/seb-requirement", ['require_seb' => true])
            ->assertUnauthorized();

        $this->signInAsAdmin();

        $this->patchJson("/api/exams/{$exam->id}/seb-requirement", [])->assertUnprocessable();
        $this->patchJson("/api/exams/{$exam->id}/seb-requirement", ['require_seb' => 'maybe'])
            ->assertUnprocessable();
    }

    public function test_teacher_can_turn_lockdown_on_and_off_before_anyone_starts(): void
    {
        $this->signInAsAdmin();
        $exam = $this->makeExam(['status' => Exam::STATUS_PUBLISHED]);

        $this->patchJson("/api/exams/{$exam->id}/seb-requirement", ['require_seb' => true])
            ->assertOk()
            ->assertJsonPath('require_seb', true);

        $this->patchJson("/api/exams/{$exam->id}/seb-requirement", ['require_seb' => false])
            ->assertOk()
            ->assertJsonPath('require_seb', false);
    }

    public function test_setting_is_locked_once_a_student_has_started(): void
    {
        $this->signInAsAdmin();
        $exam = $this->makeExam(['status' => Exam::STATUS_PUBLISHED]);
        $exam->sessions()->create([
            'student_name' => 'Ana', 'student_number' => '2024-001', 'status' => 'in_progress',
            'started_at' => now(), 'expires_at' => now()->addMinutes(30),
        ]);

        $this->patchJson("/api/exams/{$exam->id}/seb-requirement", ['require_seb' => true])
            ->assertStatus(409);
        $this->assertFalse($exam->fresh()->require_seb);
    }
}