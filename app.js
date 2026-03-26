/* ═══════════════════════════════════════════
   GetDieted — app.js
   Calls the local Node proxy — API key is
   stored server-side in .env, never exposed.
   ═══════════════════════════════════════════ */

// ── Staggered entrance animations ──
(function() {
  const els = document.querySelectorAll('[data-anim]');
  const BASE_DELAY = 120; // ms per step

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const step = parseInt(el.dataset.delay || 0, 10);
        setTimeout(() => el.classList.add('is-visible'), step * BASE_DELAY);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.1 });

  // Hero elements fire immediately on load
  els.forEach(el => {
    const isHero = el.closest('.hero') || el.closest('.site-header') || el.classList.contains('scroll-cue');
    if (isHero) {
      const step = parseInt(el.dataset.delay || 0, 10);
      setTimeout(() => el.classList.add('is-visible'), 80 + step * BASE_DELAY);
    } else {
      observer.observe(el);
    }
  });
})();

// ── DOM References ──
const form        = document.getElementById('diet-form');
const generateBtn = document.getElementById('generate-btn');
const resultSec   = document.getElementById('result-section');
const resultBody  = document.getElementById('result-body');
const resultMeta  = document.getElementById('result-meta');
const errorBox    = document.getElementById('error-box');
const errorMsg    = document.getElementById('error-msg');
const copyBtn     = document.getElementById('copy-btn');
const printBtn    = document.getElementById('print-btn');
const regenBtn    = document.getElementById('regenerate-btn');

// ── Form submit ──
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await generateDietPlan();
});

regenBtn.addEventListener('click', () => {
  resultSec.style.display = 'none';
  generateDietPlan();
});

// ── Copy button ──
copyBtn.addEventListener('click', async () => {
  const text = resultBody.innerText;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>
      Copied!`;
    setTimeout(() => {
      copyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy`;
    }, 2000);
  } catch {
    alert('Unable to copy. Please select and copy manually.');
  }
});

// ── Print button ──
printBtn.addEventListener('click', () => window.print());

// ── Main generator ──
async function generateDietPlan() {
  hideError();

  // ── Gather values ──
  const weight   = document.getElementById('weight').value.trim();
  const height   = document.getElementById('height').value.trim();
  const age      = document.getElementById('age').value.trim();
  const calories = document.getElementById('calories').value.trim();
  const gender   = document.querySelector('input[name="gender"]:checked')?.value || 'Male';
  const diet     = document.querySelector('input[name="diet"]:checked')?.value || 'Vegetarian';
  const activity = document.getElementById('activity').value;
  const goal     = document.getElementById('goal').value;
  const notes    = document.getElementById('notes').value.trim();
  const proteinPowder = document.getElementById('protein-powder').checked;

  // ── Validate ──
  const errors = [];
  if (!weight   || isNaN(weight))   errors.push({ id: 'weight',   msg: 'Enter a valid weight in kg.' });
  if (!height   || isNaN(height))   errors.push({ id: 'height',   msg: 'Enter a valid height in cm.' });
  if (!age      || isNaN(age))      errors.push({ id: 'age',      msg: 'Enter a valid age.' });
  if (!calories || isNaN(calories)) errors.push({ id: 'calories', msg: 'Enter estimated daily calories burnt.' });

  // Clear old errors
  document.querySelectorAll('.mf-input, .fb-textarea').forEach(el => el.classList.remove('error'));
  document.querySelectorAll('.field-error-msg').forEach(el => el.remove());

  if (errors.length) {
    errors.forEach(err => {
      const el = document.getElementById(err.id);
      if (el) {
        el.classList.add('error');
        const msg = document.createElement('p');
        msg.className = 'field-error-msg';
        msg.textContent = err.msg;
        el.closest('.metric-field, .field-block')?.appendChild(msg);
      }
    });
    showError(errors[0].msg);
    return;
  }

  // ── Calculate BMI ──
  const bmi = (parseFloat(weight) / ((parseFloat(height) / 100) ** 2)).toFixed(1);
  const bmiCategory =
    bmi < 18.5 ? 'Underweight' :
    bmi < 25   ? 'Normal weight' :
    bmi < 30   ? 'Overweight' : 'Obese';

  // ── Build prompt ──
  const prompt = buildPrompt({ weight, height, age, bmi, bmiCategory, calories, gender, diet, activity, goal, notes, proteinPowder });

  // ── UI: loading state ──
  generateBtn.classList.add('loading');
  generateBtn.disabled = true;
  resultSec.style.display = 'none';

  try {
    // ✅ Calls our local Node proxy — API key is NEVER in this file
    const response = await fetch('/api/diet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || `Server error ${response.status}`);
    }

    const rawText = data?.content?.[0]?.text || '';
    if (!rawText) throw new Error('Empty response from Claude. Please try again.');

    // ── Render result ──
    resultMeta.textContent = `${gender} • ${diet} • ${weight} kg • ${height} cm • BMI ${bmi} (${bmiCategory})`;
    resultBody.innerHTML = markdownToHtml(rawText);
    resultSec.style.display = 'block';
    resultSec.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    let msg = err.message || 'Unknown error';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      msg = 'Cannot reach the server. Make sure you ran: node server.js';
    }
    showError(msg);
  } finally {
    generateBtn.classList.remove('loading');
    generateBtn.disabled = false;
  }
}

// ── Prompt Builder ──
function buildPrompt({ weight, height, age, bmi, bmiCategory, calories, gender, diet, activity, goal, notes, proteinPowder }) {
  return `You are an expert Indian nutritionist and dietitian with deep knowledge of traditional Indian cuisine, Ayurveda, and modern sports nutrition.

Create a comprehensive, personalised **Indian weight-loss diet plan** for this individual:

---
**Personal Details:**
- Gender: ${gender}
- Age: ${age} years
- Weight: ${weight} kg
- Height: ${height} cm
- BMI: ${bmi} (${bmiCategory})
- Estimated daily calories burnt (TDEE): ${calories} kcal
- Diet preference: ${diet}
- Activity level: ${activity}
- Weight loss goal: ${goal}
- Additional notes / allergies / health conditions: ${notes || 'None'}
- Protein powder available: ${proteinPowder ? 'YES — person can drink protein shake TWICE a day (once in the morning / pre-workout and once post-workout). Include exactly 2 protein shake servings in the daily meal plan.' : 'No'}

---
**Please include:**

1. **📊 Calorie & Macro Summary** — Target daily calories, protein, carbs, fat breakdown, and estimated weekly weight loss

2. **🌅 Full 7-Day Meal Plan** — For each day include:
   - Early morning (pre-breakfast)
   - Breakfast
   - Mid-morning snack
   - Lunch
   - Evening snack
   - Dinner
   - Approximate calories for each meal

3. **🥗 Indian Foods to Eat Freely** — nutrient-dense, low-calorie traditional options

4. **🚫 Foods to Avoid** — list foods that hinder weight loss, including Indian junk food

5. **💧 Hydration & Lifestyle Tips** — water intake, sleep, stress management tailored to Indian lifestyle

6. **🌿 Ayurvedic & Traditional Tips** — natural Indian remedies and habits that aid weight loss (jeera water, methi, etc.)

7. **🏃 Exercise Pairing** — brief recommendation on workouts to complement the diet

8. **⚠️ Important Disclaimer** — note this is AI-generated and user should consult a registered dietitian for medical conditions

Format using markdown with tables where appropriate. Make it practical, motivating, and culturally relevant to India. Use Indian food names with English translations in brackets.`;
}

// ── Minimal Markdown → HTML ──
function markdownToHtml(md) {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^---+$/gm, '<hr/>')
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Tables
  html = html.replace(/(\|.+\|\n)+/g, (table) => {
    const lines = table.trim().split('\n');
    if (lines.length < 2) return table;
    const header = lines[0];
    const body   = lines.slice(2);
    const parseRow = (row, tag) =>
      '<tr>' + row.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1)
        .map(cell => `<${tag}>${cell.trim()}</${tag}>`).join('') + '</tr>';
    return `<table><thead>${parseRow(header, 'th')}</thead><tbody>` +
      body.map(r => parseRow(r, 'td')).join('') + '</tbody></table>';
  });

  // Lists (unordered)
  html = html.replace(/(^[*\-] .+\n?)+/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[*\-] /, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Lists (ordered)
  html = html.replace(/(^\d+\. .+\n?)+/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs
  html = html.split('\n').map(line => {
    if (!line.trim()) return '';
    if (/^<(h[1-6]|ul|ol|li|table|thead|tbody|tr|th|td|hr|blockquote|p)/.test(line)) return line;
    return `<p>${line}</p>`;
  }).join('\n');

  return html;
}

// ── Error helpers ──
function showError(msg) {
  errorMsg.textContent = msg;
  errorBox.style.display = 'flex';
  errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function hideError() {
  errorBox.style.display = 'none';
}
