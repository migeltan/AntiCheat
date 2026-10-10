<?php

namespace Tests\Feature;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GoogleFormFetchTest extends TestCase
{
    private const URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdummyformid123456/viewform';

    public function test_rejects_non_google_and_non_form_urls_without_fetching(): void
    {
        Http::fake();

        foreach ([
            'http://docs.google.com/forms/d/e/1FAIpQLSdummyformid123456/viewform',
            'https://evil.example/forms/d/e/1FAIpQLSdummyformid123456/viewform',
            'https://docs.google.com.evil.example/forms/d/e/1FAIpQLSdummyformid123456/viewform',
            'https://docs.google.com@evil.example/forms/d/e/1FAIpQLSdummyformid123456/viewform',
            'https://docs.google.com/forms/d/1FAIpQLSdummyformid123456/edit',
            'https://docs.google.com/document/d/1FAIpQLSdummyformid123456/viewform',
            'http://169.254.169.254/latest/meta-data',
        ] as $bad) {
            $this->postJson('/api/forms/fetch', ['url' => $bad])->assertStatus(422);
        }

        Http::assertNothingSent();
    }

    public function test_returns_page_source_for_a_public_form(): void
    {
        $html = '<script>var FB_PUBLIC_LOAD_DATA_ = [];</script>';
        Http::fake(['docs.google.com/*' => Http::response($html, 200)]);

        $this->postJson('/api/forms/fetch', ['url' => self::URL.'?usp=sf_link'])
            ->assertOk()
            ->assertJsonPath('source', $html);

        Http::assertSent(fn ($request) => $request->url() === self::URL);
    }

    public function test_private_form_login_redirect_is_rejected(): void
    {
        Http::fake(['docs.google.com/*' => Http::response('', 302, [
            'Location' => 'https://accounts.google.com/ServiceLogin',
        ])]);

        $this->postJson('/api/forms/fetch', ['url' => self::URL])->assertStatus(422);
    }

    public function test_upstream_failure_returns_502(): void
    {
        Http::fake(['docs.google.com/*' => fn () => throw new ConnectionException('boom')]);

        $this->postJson('/api/forms/fetch', ['url' => self::URL])->assertStatus(502);
    }
}