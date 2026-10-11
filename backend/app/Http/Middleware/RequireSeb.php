<?php

namespace App\Http\Middleware;

use App\Models\Exam;
use App\Models\ExamSession;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Lockdown: for exams with require_seb on, only Safe Exam Browser may take part.
// SEB identifies itself with "SEB/<version>" in its user agent.
class RequireSeb
{
    public function handle(Request $request, Closure $next): Response
    {
        $exam = $this->examFor($request);

        if ($exam?->require_seb && ! $this->insideSeb($request)) {
            return response()->json([
                'message' => 'This exam must be taken in Safe Exam Browser.',
                'code' => 'seb_required',
            ], 403);
        }

        return $next($request);
    }

    private function examFor(Request $request): ?Exam
    {
        $session = $request->route('examSession');

        if ($session !== null) {
            if (! $session instanceof ExamSession) {
                $session = ExamSession::find($session);
            }

            return $session?->exam;
        }

        $code = $request->route('code');

        return $code ? Exam::where('exam_code', strtoupper($code))->first() : null;
    }

    private function insideSeb(Request $request): bool
    {
        logger()->info('SEB check', ['user_agent' => $request->userAgent()]);

        return str_contains((string) $request->userAgent(), 'SEB/');
    }
}