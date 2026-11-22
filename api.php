<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const QUESTIONS_FILE = __DIR__ . '/data/questions.json';
const RANKING_FILE = __DIR__ . '/data/ranking.json';

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function readJson(string $path): array
{
    if (!is_file($path)) return [];
    $content = file_get_contents($path);
    $decoded = json_decode($content === false ? '[]' : $content, true);
    return is_array($decoded) ? $decoded : [];
}

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'questions') {
    $questionData = readJson(QUESTIONS_FILE);
    $questions = $questionData['questions'] ?? [];
    $publicQuestions = array_map(static function (array $question): array {
        unset($question['answer']);
        return $question;
    }, $questions);
    $publicPassages = $questionData['passages'] ?? [];
    respond(200, ['exam' => $questionData['exam'] ?? [], 'exams' => $questionData['exams'] ?? [], 'questions' => $publicQuestions, 'passages' => $publicPassages]);
    $publicQuestions = array_map(static function (array $question): array {
        unset($question['answer']);
        return $question;
    }, $questions);
    respond(200, ['questions' => $publicQuestions]);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'ranking') {
    $ranking = readJson(RANKING_FILE);
    usort($ranking, static fn(array $a, array $b): int => strcmp((string)($b['date'] ?? ''), (string)($a['date'] ?? '')));
    respond(200, ['ranking' => array_slice($ranking, 0, 100)]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'submit') {
    $input = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($input)) respond(400, ['error' => 'Não foi possível ler o resultado.']);

    $name = trim(strip_tags((string)($input['name'] ?? '')));
    $state = trim(strip_tags((string)($input['state'] ?? '')));
    $city = trim(strip_tags((string)($input['city'] ?? '')));
    $answers = $input['answers'] ?? null;
    $length = (int)($input['length'] ?? 0);
    if ($name === '' || (function_exists('mb_strlen') ? mb_strlen($name, 'UTF-8') : strlen($name)) > 60 || $state === '' || $city === '' || !is_array($answers) || !in_array($length, [10, 30, 60], true)) {
        respond(422, ['error' => 'Confira os seus dados e tente novamente.']);
    }

    $questionData = readJson(QUESTIONS_FILE);
    $questions = $questionData['questions'] ?? [];
    $answerKey = [];
    foreach ($questions as $question) {
        if (isset($question['id'])) {
            $answerKey[(string)$question['id']] = ['answer' => $question['answer'] ?? null, 'voided' => !empty($question['voided'])];
        }
    }
    $validAnswers = 0;
    $correct = 0;
    $voidedCount = 0;
    foreach ($answers as $questionId => $answer) {
        $id = (string)$questionId;
        if (!isset($answerKey[$id]) || !is_string($answer)) continue;
        $item = $answerKey[$id];
        if ($item['voided'] && $answer === 'VOIDED') {
            $validAnswers++;
            $correct++;
            $voidedCount++;
        } elseif (!$item['voided'] && in_array($answer, ['A','B','C','D','E'], true)) {
            $validAnswers++;
            if ($answer === $item['answer']) $correct++;
        }
    }
    if ($validAnswers !== $length) respond(422, ['error' => 'As respostas enviadas não correspondem ao simulado.']);

    $score = (int)round(($correct / $length) * 100);
    $status = $score > 80 ? 'Aprovado' : ($score >= 60 ? 'Fila de remanejamento' : 'Reprovado');
    $entry = [
        'name' => $name,
        'state' => $state,
        'city' => $city,
        'score' => $score,
        'correct' => $correct,
        'total' => $length,
        'voided' => $voidedCount,
        'status' => $status,
        'date' => (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\\TH:i:s.u\\Z'),
    ];

    $handle = fopen(RANKING_FILE, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) respond(500, ['error' => 'Não foi possível salvar o ranking.']);
    $contents = stream_get_contents($handle);
    $ranking = json_decode($contents ?: '[]', true);
    if (!is_array($ranking)) $ranking = [];
    $ranking[] = $entry;
    usort($ranking, static fn(array $a, array $b): int => strcmp((string)($b['date'] ?? ''), (string)($a['date'] ?? '')));
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($ranking, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    respond(201, ['result' => $entry]);
}

respond(404, ['error' => 'Ação não encontrada.']);
