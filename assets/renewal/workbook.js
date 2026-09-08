const form = document.querySelector('[data-workbook-form]');
if (form) {
  let requestId = crypto.randomUUID();
  let lastPayload = '';
  const status = form.querySelector('[role="status"]');
  const button = form.querySelector('button[type="submit"]');
  const name = form.elements.namedItem('name');
  name.addEventListener('input', () => name.setCustomValidity(''));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    name.setCustomValidity(name.value.trim() ? '' : 'お名前をご入力ください。');
    if (!form.reportValidity() || button.disabled) return;
    const fields = {name: name.value.trim(), email: form.elements.namedItem('email').value.trim(), privacy: form.elements.namedItem('privacy').checked, updates: form.elements.namedItem('updates').checked, website: form.elements.namedItem('website').value};
    const fingerprint = JSON.stringify(fields);
    if (lastPayload && lastPayload !== fingerprint) requestId = crypto.randomUUID();
    lastPayload = fingerprint;
    button.disabled = true; form.setAttribute('aria-busy', 'true'); status.textContent = 'お申し込みを受け付けています…';
    try {
      const challengeResponse = await fetch(form.dataset.api + '/challenge', {mode: 'cors', cache: 'no-store', signal: AbortSignal.timeout(15000)});
      const challenge = await challengeResponse.json();
      if (!challengeResponse.ok || !challenge.challenge) throw new Error(challenge.error || '受付に接続できませんでした。');
      const response = await fetch(form.dataset.api + '/register', {method: 'POST', mode: 'cors', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...fields, id: requestId, challenge: challenge.challenge}), signal: AbortSignal.timeout(20000)});
      const result = await response.json();
      if (!response.ok || !result.accepted) throw new Error(result.error || '受付を完了できませんでした。');
      try { sessionStorage.setItem('chiero-workbook-receipt', 'accepted'); } catch {}
      location.assign(form.dataset.thanks);
    } catch (error) {
      status.textContent = error instanceof Error && error.name !== 'TimeoutError' && error.name !== 'TypeError' ? error.message : '通信を確認して、もう一度お試しください。';
      status.focus();
    } finally { button.disabled = false; form.removeAttribute('aria-busy'); }
  });
}
