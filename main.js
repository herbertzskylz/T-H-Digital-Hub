

   //automatic year load
  document.getElementById('year').textContent = new Date().getFullYear();
   
   

'use strict';

// ===== NAVBAR =====
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    const open = navLinks.classList.contains('open');
    hamburger.setAttribute('aria-expanded', open);
    hamburger.querySelectorAll('span')[0].style.transform = open ? 'rotate(45deg) translate(5px,5px)' : '';
    hamburger.querySelectorAll('span')[1].style.opacity = open ? '0' : '1';
    hamburger.querySelectorAll('span')[2].style.transform = open ? 'rotate(-45deg) translate(5px,-5px)' : '';
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!navbar.contains(e.target)) navLinks.classList.remove('open');
  });
}

// ===== BUSINESS HOURS =====
function updateOpenStatus() {
  const dots = document.querySelectorAll('.hours-dot');
  if (!dots.length) return;

  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...6=Sat
  const hour = now.getHours() + now.getMinutes() / 60;

  let isOpen = false;
  if (day >= 1 && day <= 5) isOpen = hour >= 8 && hour < 18;      // Mon-Fri 8-18
  else if (day === 6) isOpen = hour >= 9 && hour < 17;              // Sat 9-17
  else if (day === 0) isOpen = hour >= 10 && hour < 15;             // Sun 10-15

  dots.forEach(dot => {
    dot.className = `hours-dot ${isOpen ? 'open' : 'closed'}`;
  });

  const strongEl = dots[0]?.nextElementSibling;
  if (strongEl) strongEl.textContent = isOpen ? 'Open Now' : 'Currently Closed';

  if (!isOpen) {
    dots.forEach(dot => dot.style.background = '#f87171');
  }
}
updateOpenStatus();

// ===== CSRF TOKEN SETUP =====
function generateToken() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2,'0')).join('');
}

const csrfEl = document.getElementById('csrfToken');
const tsEl = document.getElementById('formTimestamp');
if (csrfEl) csrfEl.value = generateToken();
if (tsEl) tsEl.value = Date.now().toString();

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mqegkaqa';

// ===== RATE LIMITING =====
const RATE_KEY = 't&h_form_submissions';
const RATE_LIMIT = 3;
const RATE_WINDOW = 10 * 60 * 1000; // 10 minutes

function checkRateLimit() {
  try {
    const raw = sessionStorage.getItem(RATE_KEY);
    const history = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const recent = history.filter(t => now - t < RATE_WINDOW);
    if (recent.length >= RATE_LIMIT) return false;
    recent.push(now);
    sessionStorage.setItem(RATE_KEY, JSON.stringify(recent));
    return true;
  } catch { return true; } // fallback allow
}

// ===== FORM VALIDATION HELPERS =====
function isValidPhone(val) { return /^[\d\s\+\-\(\)]{7,20}$/.test(val.trim()); }
function isValidEmail(val) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()); }
function sanitize(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML.trim();
}

function validateField(input) {
  const group = input.closest('.form-group');
  if (!group) return true;
  const id = input.id;
  let valid = true;

  if (input.required || input.value.trim()) {
    if (id === 'phone' && input.value.trim() && !isValidPhone(input.value)) valid = false;
    if (id === 'email' && input.value.trim() && !isValidEmail(input.value)) valid = false;
    if ((input.required || input.getAttribute('required') !== null) && !input.value.trim()) valid = false;
    if (input.tagName === 'SELECT' && input.required && !input.value) valid = false;
    if (input.tagName === 'TEXTAREA' && input.required && !input.value.trim()) valid = false;
  }

  group.classList.toggle('error', !valid);
  return valid;
}

// ===== SERVICE REQUEST FORM =====
const serviceForm = document.getElementById('serviceForm');
if (serviceForm) {
  // Real-time validation
  serviceForm.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('blur', () => validateField(el));
    el.addEventListener('input', () => {
      const g = el.closest('.form-group');
      if (g && g.classList.contains('error')) validateField(el);
    });
  });

  serviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const errEl = document.getElementById('submitError');
    const successEl = document.getElementById('formSuccess');
    errEl.style.display = 'none';

    // Honeypot check
    const honey = serviceForm.querySelector('input[name="_honey"]');
    if (honey && honey.value) return; // silent bot rejection

    // Time check (bots fill forms too fast)
    const formTs = parseInt(document.getElementById('formTimestamp')?.value || '0');
    if (Date.now() - formTs < 2000) {
      errEl.textContent = 'Please slow down and fill the form carefully.';
      errEl.style.display = 'block';
      return;
    }

    // Rate limit
    if (!checkRateLimit()) {
      errEl.textContent = 'Too many requests. Please wait a few minutes before trying again.';
      errEl.style.display = 'block';
      return;
    }

    // Validate all required fields
    const fields = [
      document.getElementById('fullName'),
      document.getElementById('phone'),
      document.getElementById('service'),
      document.getElementById('message'),
      document.getElementById('howContact'),
    ];
    let allValid = true;
    fields.forEach(f => { if (!validateField(f)) allValid = false; });

    const emailEl = document.getElementById('email');
    if (emailEl.value.trim() && !validateField(emailEl)) allValid = false;

    if (!allValid) {
      errEl.textContent = 'Please fill in all required fields correctly.';
      errEl.style.display = 'block';
      return;
    }

    const btn = document.getElementById('submitBtn');
    const submitText = document.getElementById('submitText');
    const spinner = document.getElementById('submitSpinner');

    btn.disabled = true;
    submitText.style.display = 'none';
    spinner.style.display = 'inline';

    try {
      const payload = {
        fullName: sanitize(document.getElementById('fullName').value),
        phone: sanitize(document.getElementById('phone').value),
        email: sanitize(document.getElementById('email').value),
        service: sanitize(document.getElementById('service').value),
        message: sanitize(document.getElementById('message').value),
        howContact: sanitize(document.getElementById('howContact').value),
        _replyto: sanitize(document.getElementById('email').value) || 'noreply@example.com',
        _subject: `New Service Request: ${sanitize(document.getElementById('service').value)}`
      };

      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Server error');

      serviceForm.reset();
      serviceForm.style.display = 'none';
      successEl.classList.add('show');
      successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      errEl.textContent = 'Could not send your request right now. Please try again in a few minutes.';
      errEl.style.display = 'block';
      console.error('Formspree error:', error);
    } finally {
      btn.disabled = false;
      submitText.style.display = 'inline';
      spinner.style.display = 'none';
    }
  });
}

// ===== ENQUIRY FORM =====
const enquiryForm = document.getElementById('enquiryForm');
if (enquiryForm) {
  enquiryForm.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('blur', () => validateField(el));
  });

  enquiryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const honey = enquiryForm.querySelector('input[name="_honey2"]');
    if (honey && honey.value) return;

    const fields = [
      document.getElementById('eName'),
      document.getElementById('eContact'),
      document.getElementById('eMessage'),
    ];
    let valid = true;
    fields.forEach(f => { if (!f.value.trim()) { f.closest('.form-group').classList.add('error'); valid = false; } });
    if (!valid) return;

    if (!checkRateLimit()) return;

    const btn = document.getElementById('enquiryBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Sending…';

    try {
      const payload = {
        name: sanitize(document.getElementById('eName').value),
        contact: sanitize(document.getElementById('eContact').value),
        message: sanitize(document.getElementById('eMessage').value),
        _replyto: sanitize(document.getElementById('eContact').value),
        _subject: `General Enquiry from ${sanitize(document.getElementById('eName').value)}`
      };

      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Server error');

      enquiryForm.reset();
      enquiryForm.style.display = 'none';
      document.getElementById('enquirySuccess').classList.add('show');
    } catch (error) {
      alert('Could not send your enquiry right now. Please try again in a few minutes.');
      console.error('Formspree enquiry error:', error);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Message';
    }
  });
}

// ===== SCROLL REVEAL =====
function reveal() {
  const els = document.querySelectorAll('.service-card, .tcard, .product-card, .about-img-block, .about-text, .stat, .cinfo-item');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  els.forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = `opacity 0.5s ${i * 0.05}s ease, transform 0.5s ${i * 0.05}s ease`;
    observer.observe(el);
  });
}
document.addEventListener('DOMContentLoaded', reveal);

// ===== SMOOTH ANCHOR SCROLL =====
document.querySelectorAll('a[href*="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (href.startsWith('#')) {
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
});
