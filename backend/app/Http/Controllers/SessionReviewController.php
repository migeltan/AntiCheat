<?php

namespace App\Http\Controllers;

use App\Models\ExamSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SessionReviewController extends Controller
{
    // Admin: one session including the teacher's verdict (the student route hides it)
    public function show(ExamSession $examSession): JsonResponse
    {
        return response()->json($this->present($examSession));
    }

    // Admin: record, change or remove the verdict ('pending' removes it)
    public function update(Request $request, ExamSession $examSession): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in([ExamSession::REVIEW_FLAGGED, ExamSession::REVIEW_CLEARED, 'pending'])],
            'note' => [
                'nullable', 'string', 'max:1000',
                Rule::requiredIf($request->input('status') === ExamSession::REVIEW_FLAGGED),
            ],
        ], [
            'note.required' => 'Add a note explaining why this attempt is flagged.',
        ]);

        if ($data['status'] === 'pending') {
            $examSession->forceFill([
                'review_status' => null, 'review_note' => null,
                'reviewed_by' => null, 'reviewed_at' => null,
            ]);
        } else {
            $examSession->forceFill([
                'review_status' => $data['status'],
                'review_note' => $data['note'] ?? null,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);
        }

        $examSession->save();

        return response()->json($this->present($examSession));
    }

    private function present(ExamSession $session): array
    {
        $session->load(['exam', 'reviewer:id,name,employee_id']);

        return $session->makeVisible(ExamSession::REVIEW_FIELDS)->toArray();
    }
}