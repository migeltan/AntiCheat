<?php

namespace App\Http\Controllers;

use App\Models\Exam;
use App\Models\ExamSession;
use App\Models\Question;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class QuestionController extends Controller
{
    // Admin: import the full question list for an exam
    public function import(Request $request, Exam $exam): JsonResponse
    {
        $data = $request->validate([
            'questions' => 'required|array|min:1',
            'questions.*.type' => ['required', Rule::in(Question::TYPES)],
            'questions.*.prompt' => 'required|string|max:2000',
            'questions.*.options' => 'nullable|array',
            'questions.*.options.*' => 'string|max:500',
            'questions.*.required' => 'sometimes|boolean',
        ]);

        if ($exam->status !== Exam::STATUS_DRAFT) {
            return response()->json(['message' => 'Questions can only be imported while the exam is a draft.'], 409);
        }

        if ($exam->sessions()->exists()) {
            return response()->json(['message' => 'Students have already started this exam.'], 409);
        }

        foreach ($data['questions'] as $i => $q) {
            if (in_array($q['type'], Question::CHOICE_TYPES) && count($q['options'] ?? []) < 2) {
                throw ValidationException::withMessages([
                    "questions.$i.options" => 'Choice questions need at least 2 options.',
                ]);
            }
        }

        DB::transaction(function () use ($exam, $data) {
            $exam->questions()->delete();

            foreach ($data['questions'] as $i => $q) {
                $exam->questions()->create([
                    'position' => $i + 1,
                    'type' => $q['type'],
                    'prompt' => $q['prompt'],
                    'options' => in_array($q['type'], Question::CHOICE_TYPES) ? $q['options'] : null,
                    'required' => $q['required'] ?? true,
                ]);
            }
        });

        return response()->json($exam->questions()->get(), 201);
    }

    // Admin: view an exam's questions
    public function index(Exam $exam): JsonResponse
    {
        return response()->json($exam->questions()->get()->makeVisible('correct_answer'));
    }

    // Admin: set or clear the correct answers. Body: { key: { "<questionId>": "Option" | ["A","B"] | null } }
    // Draft exams only. Choice questions only (text answers are marked by the teacher).
    public function saveKey(Request $request, Exam $exam): JsonResponse
    {
        $data = $request->validate([
            'key' => 'present|array',
            'key.*' => 'nullable',
            'key.*.*' => 'string|max:500',
        ]);

        if ($exam->status !== Exam::STATUS_DRAFT) {
            return response()->json(['message' => 'The answer key can only be changed while the exam is a draft.'], 409);
        }

        $questions = $exam->questions()->get()->keyBy('id');
        $errors = [];
        $updates = [];

        foreach ($data['key'] as $id => $value) {
            $q = $questions->get((int) $id);

            if (! $q || ! in_array($q->type, Question::CHOICE_TYPES, true)) {
                $errors["key.$id"] = 'Only multiple choice and checkbox questions of this exam can have a correct answer.';
                continue;
            }

            if ($value === null || $value === '' || $value === []) {
                $updates[$q->id] = null;
                continue;
            }

            $picked = array_values(array_unique(array_map('strval', (array) $value)));

            if ($q->type === 'multiple_choice' && count($picked) !== 1) {
                $errors["key.$id"] = 'Pick exactly one correct option.';
            } elseif (array_diff($picked, $q->options ?? [])) {
                $errors["key.$id"] = 'The correct answer must be one of the options.';
            } else {
                $updates[$q->id] = $q->type === 'multiple_choice' ? $picked[0] : $picked;
            }
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        DB::transaction(function () use ($questions, $updates) {
            foreach ($updates as $id => $answer) {
                $questions[$id]->update(['correct_answer' => $answer]);
            }
        });

        return response()->json($exam->questions()->get()->makeVisible('correct_answer'));
    }

    // Student: questions for their active session
    public function forSession(ExamSession $examSession): JsonResponse
    {
        if ($examSession->status !== 'in_progress') {
            return response()->json(['message' => 'Session is already submitted.'], 409);
        }

        return response()->json($examSession->exam->questions()->get());
    }
}