/**
 * えにわ愛ポイント｜フォーム受信用 Google Apps Script
 * -------------------------------------------------------------------
 * お問い合わせ／愛称投票の送信内容を Google スプレッドシートに記録し、
 * 事務局あてにメール通知します。無料で利用できます。
 *
 * ■ 設置手順
 *   1. Googleスプレッドシートを新規作成する
 *   2. 拡張機能 → Apps Script を開き、このコードを貼り付ける
 *   3. 下の SETTINGS を必要に応じて書き換える
 *   4. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *        次のユーザーとして実行： 自分
 *        アクセスできるユーザー： 全員
 *   5. 発行された URL を site/assets/config.js の
 *        forms.contactEndpoint / forms.voteEndpoint に設定する
 *      （お問い合わせと投票で同じURLを使えます。シートは自動で分かれます）
 */

var SETTINGS = {
  // 通知メールの宛先（空にするとメール通知をしません）
  notifyTo: 'info@eniwa-point.com',

  // 通知メールの件名の先頭
  subjectPrefix: '【えにわ愛ポイント】',

  // 同一IPからの連続投稿を制限する秒数（0で無効）
  throttleSeconds: 5
};

/** フォームからの送信を受け取る */
function doPost(e) {
  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    // 投票か問い合わせかを判定（投票データには「投票案」が入る）
    var isVote = !!data['投票案'];
    var sheetName = isVote ? '愛称投票' : 'お問い合わせ';

    if (SETTINGS.throttleSeconds > 0 && isThrottled_()) {
      return json_({ ok: false, error: 'too_many_requests' });
    }

    appendRow_(sheetName, data);
    notify_(sheetName, data);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** 動作確認用（ブラウザで開くと OK と表示されます） */
function doGet() {
  return json_({ ok: true, message: 'えにわ愛ポイント フォーム受信エンドポイントです。' });
}

/* ------------------------------------------------------------------ */

function appendRow_(sheetName, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);

  // 「_」で始まるキー（_subject など）は記録しない
  var keys = Object.keys(data).filter(function (k) { return k.charAt(0) !== '_'; });

  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.appendRow(['受信日時'].concat(keys));
    sh.getRange(1, 1, 1, keys.length + 1)
      .setFontWeight('bold').setBackground('#ffeef5');
    sh.setFrozenRows(1);
  }

  // 既存ヘッダーに無い項目が来た場合は列を追加する
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  keys.forEach(function (k) {
    if (header.indexOf(k) === -1) {
      sh.getRange(1, header.length + 1).setValue(k).setFontWeight('bold').setBackground('#ffeef5');
      header.push(k);
    }
  });

  var row = header.map(function (h) {
    if (h === '受信日時') return new Date();
    return data[h] != null ? data[h] : '';
  });
  sh.appendRow(row);
}

function notify_(sheetName, data) {
  if (!SETTINGS.notifyTo) return;
  var lines = Object.keys(data)
    .filter(function (k) { return k.charAt(0) !== '_'; })
    .map(function (k) { return k + '：' + data[k]; });
  MailApp.sendEmail({
    to: SETTINGS.notifyTo,
    subject: SETTINGS.subjectPrefix + sheetName + 'が届きました',
    body: [sheetName + 'を受信しました。', '', lines.join('\n'), '',
           '— えにわ愛ポイント 公式ポータルサイト'].join('\n')
  });
}

function isThrottled_() {
  var cache = CacheService.getScriptCache();
  var key = 'last_post';
  if (cache.get(key)) return true;
  cache.put(key, '1', SETTINGS.throttleSeconds);
  return false;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 愛称投票の集計（メニューから実行できます）
 * スプレッドシートに「集計」シートを作り、A/B/C の得票数を書き出します。
 */
function 投票を集計する() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('愛称投票');
  if (!sh) { SpreadsheetApp.getUi().alert('「愛称投票」シートがありません。'); return; }

  var values = sh.getDataRange().getValues();
  var header = values.shift();
  var idx = header.indexOf('投票案');
  if (idx === -1) { SpreadsheetApp.getUi().alert('「投票案」列が見つかりません。'); return; }

  var count = {};
  values.forEach(function (r) {
    var v = String(r[idx] || '').trim();
    if (!v) return;
    count[v] = (count[v] || 0) + 1;
  });

  var out = ss.getSheetByName('集計') || ss.insertSheet('集計');
  out.clear();
  out.appendRow(['案', '得票数']);
  out.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#ffeef5');
  Object.keys(count).sort().forEach(function (k) { out.appendRow([k, count[k]]); });
  out.appendRow(['合計', values.length]);
  SpreadsheetApp.getUi().alert('集計しました。「集計」シートをご確認ください。');
}

/** スプレッドシートを開いたときにメニューを追加 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('えにわ愛ポイント')
    .addItem('投票を集計する', '投票を集計する')
    .addToUi();
}
