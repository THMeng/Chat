<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ConversationController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\UserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login',    [AuthController::class, 'login']);

// ─── Protected routes ─────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::get('/auth/me',     [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Users
    Route::get('/users',        [UserController::class, 'index']);
    Route::get('/users/search', [UserController::class, 'search']);

    // Conversations
    Route::get('/conversations',              [ConversationController::class, 'index']);
    Route::post('/conversations/direct',      [ConversationController::class, 'createDirect']);
    Route::post('/conversations/group',       [ConversationController::class, 'createGroup']);
    Route::get('/conversations/{conversation}',             [ConversationController::class, 'show']);
    Route::post('/conversations/{conversation}/members',    [ConversationController::class, 'addMember']);

    // Messages
    Route::get('/conversations/{conversation}/messages', [MessageController::class, 'index']);
    Route::post('/messages',                             [MessageController::class, 'store']);
    Route::post('/messages/{message}/read',              [MessageController::class, 'markRead']);
    Route::delete('/messages/{message}',                 [MessageController::class, 'destroy']);
});
