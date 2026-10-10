<?php

namespace App\Http\Controllers;

use App\Models\Exam;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExamController extends Controller
{
    // Admin: list exams
    public function index(): JsonResponse
    {
        return response()->json(Exam::latest()->get());
    }

    // Admin: import/save/publish exam
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'form_url' => 'nullable|url|max:2048',
            'duration_minutes' => 'required|integer|min:1|max:600',
            'max_violations' => 'sometimes|integer|min:1|max:20',
        ]);

        // Always starts as a draft; use PATCH /exams/{exam}/publish once it has questions.
        return response()->json(Exam::create([...$data, 'status' => Exam::STATUS_DRAFT]), 201);
    }

    // Student: validate exam code
    public function showByCode(string $code): JsonResponse
    {
        // Closed exams still resolve so in-progress students can resume.
        $exam = Exam::where('exam_code', strtoupper($code))
            ->whereIn('status', [Exam::STATUS_PUBLISHED, Exam::STATUS_CLOSED])
            ->first();

        if (! $exam) {
            return response()->json(['message' => 'Invalid exam code.'], 404);
        }

        return response()->json($exam);
    }

    
    // Admin: publish a draft exam, or reopen a closed one
    public function publish(Exam $exam): JsonResponse
    {
        if ($exam->status === Exam::STATUS_PUBLISHED) {
            return response()->json($exam);
        }

        if (! $exam->questions()->exists()) {
            return response()->json(['message' => 'Add at least one question before publishing.'], 422);
        }

        $exam->update(['status' => Exam::STATUS_PUBLISHED]);

        return response()->json($exam->fresh());
    }

    // Admin: stop new attempts; students already in progress can finish
    public function close(Exam $exam): JsonResponse
    {
        if ($exam->status === Exam::STATUS_CLOSED) {
            return response()->json($exam);
        }

        if ($exam->status !== Exam::STATUS_PUBLISHED) {
            return response()->json(['message' => 'Only a published exam can be closed.'], 409);
        }

        $exam->update(['status' => Exam::STATUS_CLOSED]);

        return response()->json($exam->fresh());
    }
}