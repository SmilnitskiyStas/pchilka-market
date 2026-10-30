<?php
/**
 * Plugin Name: Pchilka Archive Links
 * Description: Keep legacy frontend navigation on the temporary WordPress archive.
 */
if (!defined('ABSPATH')) {
    exit;
}

// Do not alter requests proxied through the production domain for legacy media.
if (($_SERVER['HTTP_HOST'] ?? '') !== '5.189.190.36:3002') {
    return;
}

function pchilka_archive_rewrite_links($value) {
    if (!is_string($value)) {
        return $value;
    }
    $archive = 'http://5.189.190.36:3002/';
    $origins = [
        'https://pchilka-market.ua/', 'http://pchilka-market.ua/', '//pchilka-market.ua/',
        'https://www.pchilka-market.ua/', 'http://www.pchilka-market.ua/', '//www.pchilka-market.ua/',
    ];
    $value = str_replace($origins, $archive, $value);
    // Slider settings can contain JSON-escaped URLs inside frontend scripts.
    $escaped = array_map(static function ($url) {
        return str_replace('/', '\\/', $url);
    }, $origins);
    return str_replace($escaped, str_replace('/', '\\/', $archive), $value);
}

add_filter('wp_redirect', 'pchilka_archive_rewrite_links', 10, 1);
add_action('template_redirect', static function () {
    ob_start('pchilka_archive_rewrite_links');
}, 0);
