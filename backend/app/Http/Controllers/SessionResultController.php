<?php

namespace App\Http\Controllers;

use App\Models\ExamSession;
use App\Support\Scoring;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Arr;

class SessionResultController extends Controller
{
    // Student: their own score after submitting, only if the teacher allowed it for this
    // exam. Never returns per-question results or the answer key.
    public function __invoke(ExamSession $examSession): JsonResponse
    {
        if ($examSession->status === 'in_progress') {
            return response()->json(['message' => 'Submit the exam first.'], 409);
        }

        $exam = $examSession->exam;

        if (! $exam->show_score) {
            return response()->json(['show_score' => false, 'score' => null]);
        }

        $score = Scoring::grade($exam->questions()->get(), $examSession->answers()->get());

        return response()->json([
            'show_score' => true,
            'score' => $score['total'] > 0
                ? Arr::only($score, ['earned', 'total', 'percent', 'ungraded'])
                : null,
        ]);
    }
}