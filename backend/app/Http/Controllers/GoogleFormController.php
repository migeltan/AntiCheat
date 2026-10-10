<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Psr\Http\Message\ResponseInterface;
use Throwable;

class GoogleFormController extends Controller
{
    private const MAX_BYTES = 3 * 1024 * 1024;

    // Admin: fetch a public Google Form's page source for the front-end parser
    public function fetch(Request $request): JsonResponse
    {
        $data = $request->validate(['url' => 'required|string|max:2048']);

        $url = $this->canonicalUrl($data['url']);

        if (! $url) {
            return response()->json([
                'message' => 'Use a public Google Form link (docs.google.com/forms/.../viewform).',
            ], 422);
        }

        try {
            $response = Http::withoutRedirecting()
                ->connectTimeout(5)
                ->timeout(10)
                ->withHeaders(['Accept-Language' => 'en'])
                ->withOptions(['on_headers' => function (ResponseInterface $r) {
                    if ((int) $r->getHeaderLine('Content-Length') > self::MAX_BYTES) {
                        throw new \RuntimeException('Response too large.');
                    }
                }])
                ->get($url);
        } catch (Throwable) {
            return response()->json(['message' => 'Could not fetch that form right now.'], 502);
        }

        $body = $response->body();

        if (! $response->ok()
            || strlen($body) > self::MAX_BYTES
            || ! str_contains($body, 'FB_PUBLIC_LOAD_DATA_')) {
            return response()->json([
                'message' => 'That form is not public or could not be read. Make sure anyone with the link can view it.',
            ], 422);
        }

        return response()->json(['source' => $body]);
    }

    // Only https://docs.google.com/forms/d/[e/]{id}/viewform; query and fragment are dropped.
    private function canonicalUrl(string $input): ?string
    {
        $p = parse_url(trim($input));

        if (! $p
            || strtolower($p['scheme'] ?? '') !== 'https'
            || strtolower($p['host'] ?? '') !== 'docs.google.com'
            || isset($p['user']) || isset($p['pass']) || isset($p['port'])) {
            return null;
        }

        if (! preg_match('#^/forms/d/(e/)?[A-Za-z0-9_-]{10,}/viewform/?$#', $p['path'] ?? '')) {
            return null;
        }

        return 'https://docs.google.com'.rtrim($p['path'], '/');
    }
}