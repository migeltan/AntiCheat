<?php

namespace App\Http\Middleware;

use App\Models\AdminToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $plain = $request->bearerToken();

        $token = $plain
            ? AdminToken::with('user')
                ->where('token', hash('sha256', $plain))
                ->where('expires_at', '>', now())
                ->first()
            : null;

        if (! $token || ! $token->user) {
            return response()->json(['message' => 'Please sign in.'], 401);
        }

        if (! $token->last_used_at || $token->last_used_at->lt(now()->subMinutes(5))) {
            $token->forceFill(['last_used_at' => now()])->save();
        }

        $request->setUserResolver(fn () => $token->user);
        $request->attributes->set('admin_token', $token);

        return $next($request);
    }
}