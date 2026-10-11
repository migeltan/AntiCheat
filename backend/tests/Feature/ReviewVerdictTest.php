<?php

namespace Tests\Feature;

use App\Models\Exam;
use App\Models\ExamSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SignsInAsAdmin;
use Tests\TestCase;

class ReviewVerdictTest extends TestCase
{
    use RefreshDatabase, SignsInAsAdmin;

    private function makeSession(int $maxViolations = 1): ExamSession
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

    public function test_verdict_never_reaches_student_routes(): void
    {
        $admin = $this->signInAsAdmin();
        $session = $this->makeSession();
        $session->forceFill([
            'review_status' => 'flagged', 'review_note' => 'Pasted answers',
            'reviewed_by' => $admin->id, 'reviewed_at' => now(),
        ])->save();

        $hidden = ['review_status', 'review_note', 'reviewed_by', 'reviewed_at'];

        $show = $this->getJson("/api/sessions/{$session->id}")->assertOk();
        $resume = $this->postJson("/api/exams/code/{$session->exam->exam_code}/sessions", [
            'student_name' => 'Ana', 'student_number' => '2024-001', 'consent' => true,
        ])->assertOk();

        foreach ($hidden as $field) {
            $show->assertJsonMissingPath($field);
            $resume->assertJsonMissingPath($field);
        }
    }

    public function test_admin_review_endpoints_need_a_token(): void
    {
        $session = $this->makeSession();

        $this->getJson("/api/admin/sessions/{$session->id}")->assertUnauthorized();
        $this->patchJson("/api/admin/sessions/{$session->id}/review", ['status' => 'cleared'])
            ->assertUnauthorized();
    }

    public function test_flagging_needs_a_note_and_bad_status_is_rejected(): void
    {
        $this->signInAsAdmin();
        $url = "/api/admin/sessions/{$this->makeSession()->id}/review";

        $this->patchJson($url, ['status' => 'flagged'])->assertStatus(422)->assertJsonValidationErrors('note');
        $this->patchJson($url, ['status' => 'flagged', 'note' => ''])->assertStatus(422);
        $this->patchJson($url, ['status' => 'guilty', 'note' => 'x'])->assertStatus(422);
    }

    public function test_flag_clear_and_remove_verdict(): void
    {
        $admin = $this->signInAsAdmin();
        $session = $this->makeSession();
        $url = "/api/admin/sessions/{$session->id}/review";

        $this->patchJson($url, ['status' => 'flagged', 'note' => 'Pasted answers twice'])
            ->assertOk()
            ->assertJsonPath('review_status', 'flagged')
            ->assertJsonPath('review_note', 'Pasted answers twice')
            ->assertJsonPath('reviewer.employee_id', '2020-0001-MN-0');

        $fresh = $session->fresh()->makeVisible(ExamSession::REVIEW_FIELDS);
        $this->assertSame($admin->id, $fresh->reviewed_by);
        $this->assertNotNull($fresh->reviewed_at);

        $this->patchJson($url, ['status' => 'cleared'])
            ->assertOk()->assertJsonPath('review_status', 'cleared');

        $this->patchJson($url, ['status' => 'pending'])
            ->assertOk()
            ->assertJsonPath('review_status', null)
            ->assertJsonPath('review_note', null)
            ->assertJsonPath('reviewer', null);

        $this->getJson("/api/admin/sessions/{$session->id}")
            ->assertOk()->assertJsonPath('exam.id', $session->exam_id);
    }

    public function test_summary_shows_verdicts_and_awaiting_count(): void
    {
        $this->signInAsAdmin();
        $session = $this->makeSession(maxViolations: 1);
        $session->violations()->create(['type' => 'tab_switch', 'severity' => 'medium']);
        $summary = "/api/exams/{$session->exam_id}/summary";

        $this->getJson($summary)
            ->assertJsonPath('totals.needs_review', 1)
            ->assertJsonPath('totals.awaiting_review', 1)
            ->assertJsonPath('students.0.review_status', null);

        $this->patchJson("/api/admin/sessions/{$session->id}/review", [
            'status' => 'flagged', 'note' => 'Switched tabs repeatedly',
        ])->assertOk();

        $this->getJson($summary)
            ->assertJsonPath('totals.needs_review', 1)
            ->assertJsonPath('totals.awaiting_review', 0)
            ->assertJsonPath('totals.flagged', 1)
            ->assertJsonPath('students.0.review_status', 'flagged');
    }
}