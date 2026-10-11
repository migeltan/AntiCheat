<?php

namespace App\Support;

use App\Models\Question;
use Illuminate\Support\Collection;

// Auto-scoring for choice questions that have an answer key. One point per question;
// checkboxes are all-or-nothing (the picked set must equal the key). Text answers and
// questions without a key are never scored: they are left for the teacher.
class Scoring
{
    public static function isGradable(Question $q): bool
    {
        return in_array($q->type, Question::CHOICE_TYPES, true)
            && self::normalize($q->correct_answer) !== [];
    }

    public static function isCorrect(Question $q, mixed $given): bool
    {
        return self::normalize($given) === self::normalize($q->correct_answer);
    }

    /**
     * @param  Collection<int, Question>  $questions
     * @param  Collection<int, \App\Models\Answer>  $answers
     * @return array{earned:int,total:int,percent:?int,ungraded:int,results:array<int,bool>}
     */
    public static function grade(Collection $questions, Collection $answers): array
    {
        $byQuestion = $answers->keyBy('question_id');
        $results = [];

        foreach ($questions as $q) {
            if (self::isGradable($q)) {
                $results[$q->id] = self::isCorrect($q, $byQuestion->get($q->id)?->value);
            }
        }

        $total = count($results);
        $earned = count(array_filter($results));

        return [
            'earned' => $earned,
            'total' => $total,
            'percent' => $total > 0 ? (int) round($earned / $total * 100) : null,
            'ungraded' => $questions->count() - $total,
            'results' => $results,
        ];
    }

    private static function normalize(mixed $value): array
    {
        if ($value === null) {
            return [];
        }

        return collect(is_array($value) ? $value : [$value])
            ->filter(fn ($v) => is_scalar($v))
            ->map(fn ($v) => trim((string) $v))
            ->filter(fn ($v) => $v !== '')
            ->unique()
            ->sort()
            ->values()
            ->all();
    }
}