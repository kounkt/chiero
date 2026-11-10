# シートの足し方（動画が増えた時）
1. PDF を `sheet/files/NN.pdf`（次の番号）に置く。
2. `sheet/index.html` の `<!-- SHEETS:START -->` の直後に、下のカードを足す（新しい動画が上）。
3. `git add sheet/` → commit → `git push origin main`。
4. 数分後、`curl -sI https://chiero.jp/sheet/files/NN.pdf` が 200 か確認する。

```html
<section class="card">
<h2>動画の題</h2>
<p>中身を1文で。</p>
<p><a href="/sheet/files/NN.pdf">シートを開く（PDF）</a></p>
</section>
```
