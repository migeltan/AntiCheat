<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = config('anticheat.admin_key');

        // Not configured: admin routes stay open (local demo mode).
        if (! $key) {
            return $next($request);
        }

        if (! hash_equals((string) $key, (string) $request->bearerToken())) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        return $next($request);
    }
}