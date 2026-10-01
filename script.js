// ================================================================
//  0. ИНИЦИАЛИЗАЦИЯ FIREBASE
// ================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBsBC-_jU78ye9tICP3zhBTVrxRP0eRzvc",
    authDomain: "postal-arm.firebaseapp.com",
    projectId: "postal-arm",
    storageBucket: "postal-arm.firebasestorage.app",
    messagingSenderId: "423531673390",
    appId: "1:423531673390:web:07dee2c604bb794332ecbf"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

try {
    emailjs.init({ publicKey: "kOMYXM4J-tMPdLToP" });
} catch (e) {
    console.warn('EmailJS не загружен:', e);
}

// Глобальные переменные
let currentUser = null;
let appData = {};
let goodsFilter = 'all';
let cart = [];
let cityCart = [];
let extraCart = [];
let selectedPaymentMethod = null;
let shiftOpen = true;
let shiftNumber = 1;

const VALID_KEYS = ['OPERATOR-2026', 'ADMIN-2026', 'DIRECTOR-2026', 'MASTER-2026', 'STAFF-001', 'STAFF-002'];

const SHIFT_POLICY = {
    minRestHours: 10
};

// ================================================================
//  1. АВТОРИЗАЦИЯ
// ================================================================
function is2FAVerified() {
    return sessionStorage.getItem('2faVerified') === 'true';
}

function set2FAVerified(value) {
    if (value) sessionStorage.setItem('2faVerified', 'true');
    else sessionStorage.removeItem('2faVerified');
}

function saveUIPosition() {
    const activePage = document.querySelector('.page-section.active');
    if (!activePage) return;
    const activeTab = activePage.querySelector('.tab-content.active');
    const activeSubTab = activePage.querySelector('.sub-tab-content.active');
    sessionStorage.setItem('uiPosition', JSON.stringify({
        page: activePage.id,
        tab: activeTab ? activeTab.id : null,
        subTab: activeSubTab ? activeSubTab.id : null
    }));
}

function restoreUIPosition() {
    const saved = sessionStorage.getItem('uiPosition');
    if (!saved) return;
    try {
        const position = JSON.parse(saved);
        if (position.page) {
            document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
            const page = document.getElementById(position.page);
            if (page) page.classList.add('active');
            document.querySelectorAll('.nav-menu a[data-page]').forEach(a => a.classList.remove('active'));
            const navLink = document.querySelector(`.nav-menu a[data-page="${position.page.replace('page-', '')}"]`);
            if (navLink) navLink.classList.add('active');
        }
        const activePage = document.querySelector('.page-section.active');
        if (!activePage) return;
        if (position.tab) {
            activePage.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            const tab = activePage.querySelector('#' + position.tab);
            if (tab) {
                tab.classList.add('active');
                activePage.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                const tabBtn = activePage.querySelector(`.tab-btn[data-tab="${position.tab}"]`);
                if (tabBtn) tabBtn.classList.add('active');
            }
        }
        if (position.subTab) {
            const activeTab = activePage.querySelector('.tab-content.active');
            if (activeTab) {
                activeTab.querySelectorAll('.sub-tab-content').forEach(el => el.classList.remove('active'));
                const subTab = activeTab.querySelector('#' + position.subTab);
                if (subTab) {
                    subTab.classList.add('active');
                    activeTab.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
                    const subTabBtn = activeTab.querySelector(`.sub-tab-btn[data-subtab="${position.subTab}"]`);
                    if (subTabBtn) subTabBtn.classList.add('active');
                }
            }
        }
    } catch (e) {
        console.warn('Не удалось восстановить позицию:', e);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const key = document.getElementById('loginKey').value.trim();

    if (!email || !key) {
        document.getElementById('authError').textContent = '❌ Заполните все поля!';
        return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        document.getElementById('authError').textContent = '❌ Некорректный email!';
        return false;
    }

    const btn = e.target.querySelector('.btn-auth');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверка...';
    btn.disabled = true;

    try {
        const allowedDoc = await db.collection('allowed_users').doc(email).get();
        if (!allowedDoc.exists) {
            document.getElementById('authError').textContent = '❌ Этот email не зарегистрирован в системе.';
            btn.innerHTML = originalText;
            btn.disabled = false;
            return false;
        }
        const userData = allowedDoc.data();
        if (userData.active === false) {
            document.getElementById('authError').textContent = '❌ Учётная запись заблокирована.';
            btn.innerHTML = originalText;
            btn.disabled = false;
            return false;
        }

        try {
            await auth.signInWithEmailAndPassword(email, key);
            await auth.signOut();
        } catch (err) {
            if (err.code === 'auth/user-not-found') {
                document.getElementById('authError').textContent = '❌ Пользователь не найден в Firebase.';
            } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-login-credentials') {
                document.getElementById('authError').textContent = '❌ Неверный ключ доступа.';
            } else if (err.code === 'auth/too-many-requests') {
                document.getElementById('authError').textContent = '❌ Слишком много попыток. Подождите 5 минут.';
            } else {
                document.getElementById('authError').textContent = '❌ Ошибка: ' + err.message;
            }
            btn.innerHTML = originalText;
            btn.disabled = false;
            return false;
        }

        const role = userData.role || 'Сотрудник отделения';
        const name = userData.name || 'Сотрудник';
        window._pendingLogin = { email, key, role, name };

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        window._currentOTP = otp;
        window._otpExpiry = Date.now() + 10 * 60 * 1000;

        await emailjs.send("service_xtd82fp", "template_pjbkqhf", { user_email: email, otp_code: otp });

        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('otpSection').style.display = 'block';
        document.getElementById('otpEmailDisplay').textContent = email;
        document.getElementById('otpCode').value = '';
        document.getElementById('otpError').textContent = '';
        document.getElementById('otpCode').focus();

        showToast('✅ Код отправлен на ' + email, 'success');
    } catch (error) {
        console.error('Ошибка входа:', error);
        document.getElementById('authError').textContent = '❌ Не удалось отправить код. Попробуйте позже.';
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
    return false;
}

function logout() {
    sessionStorage.removeItem('2faVerified');
    sessionStorage.removeItem('authScreenPassed');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('userRole');

    auth.signOut().then(() => {
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('authError').textContent = '';
        showToast('Вы вышли из системы', 'info');
    }).catch((error) => {
        console.error('Ошибка выхода:', error);
    });
}

function verifyOTP(e) {
    e.preventDefault();
    const enteredCode = document.getElementById('otpCode').value.trim();
    if (!enteredCode) {
        document.getElementById('otpError').textContent = '❌ Введите код!';
        return false;
    }
    if (Date.now() > window._otpExpiry) {
        document.getElementById('otpError').textContent = '❌ Код истёк. Запросите новый.';
        return false;
    }
    if (enteredCode !== window._currentOTP) {
        document.getElementById('otpError').textContent = '❌ Неверный код!';
        return false;
    }

    const { email, key, role, name } = window._pendingLogin;

    auth.signInWithEmailAndPassword(email, key)
        .then((userCredential) => {
            set2FAVerified(true);
            sessionStorage.setItem('authScreenPassed', 'true');
            sessionStorage.setItem('userName', name);
            sessionStorage.setItem('userRole', role);

            currentUser = userCredential.user;
            document.getElementById('authScreen').style.display = 'none';
            document.getElementById('sidebar').style.display = 'flex';
            document.getElementById('mainContent').style.display = 'block';
            document.getElementById('displayName').textContent = name;
            document.getElementById('displayRole').textContent = role;
            document.getElementById('avatarLetter').textContent = name.charAt(0).toUpperCase();

            document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
            const firstPage = document.querySelector('.page-section');
            if (firstPage) firstPage.classList.add('active');

            window._pendingLogin = null;
            window._currentOTP = null;
            document.getElementById('otpSection').style.display = 'none';
            document.getElementById('loginForm').style.display = 'block';
            document.getElementById('otpCode').value = '';

            initData();
            renderAll();
            showToast('Добро пожаловать, ' + name + '!', 'success');
            setTimeout(() => loadDataFromFirestore(), 500);
        })
        .catch((error) => {
            console.error('Ошибка входа:', error.code, error.message);
            if (error.code === 'auth/user-not-found') {
                auth.createUserWithEmailAndPassword(email, key)
                    .then((userCredential) => {
                        currentUser = userCredential.user;
                        return currentUser.updateProfile({ displayName: name });
                    })
                    .then(() => {
                        document.getElementById('authScreen').style.display = 'none';
                        document.getElementById('sidebar').style.display = 'flex';
                        document.getElementById('mainContent').style.display = 'block';
                        document.getElementById('displayName').textContent = name;
                        document.getElementById('displayRole').textContent = role;
                        document.getElementById('avatarLetter').textContent = name.charAt(0).toUpperCase();
                        document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
                        const firstPage = document.querySelector('.page-section');
                        if (firstPage) firstPage.classList.add('active');
                        window._pendingLogin = null;
                        window._currentOTP = null;
                        document.getElementById('otpSection').style.display = 'none';
                        document.getElementById('loginForm').style.display = 'block';
                        document.getElementById('otpCode').value = '';
                        initData();
                        renderAll();
                        showToast('Добро пожаловать, ' + name + '!', 'success');
                        setTimeout(() => saveDataToFirestore(), 500);
                    })
                    .catch((regError) => {
                        console.error('Ошибка регистрации:', regError);
                        document.getElementById('otpError').textContent = '❌ Ошибка: ' + regError.message;
                    });
            } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-login-credentials') {
                document.getElementById('otpError').textContent = '❌ Неверный ключ доступа для этого email.';
            } else {
                document.getElementById('otpError').textContent = '❌ Ошибка: ' + error.message;
            }
        });
    return false;
}

function resendOTP() {
    if (!window._pendingLogin) {
        showToast('Ошибка: начните вход заново', 'error');
        return;
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    window._currentOTP = otp;
    window._otpExpiry = Date.now() + 10 * 60 * 1000;
    emailjs.send("service_xtd82fp", "template_pjbkqhf", {
        user_email: window._pendingLogin.email,
        otp_code: otp
    }).then(() => {
        document.getElementById('otpCode').value = '';
        document.getElementById('otpError').textContent = '';
        showToast('✅ Новый код отправлен!', 'success');
    }).catch((err) => {
        console.error('Ошибка повторной отправки:', err);
        showToast('❌ Ошибка отправки', 'error');
    });
}

function backToLogin() {
    window._pendingLogin = null;
    window._currentOTP = null;
    document.getElementById('otpSection').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('otpCode').value = '';
    document.getElementById('otpError').textContent = '';
    document.getElementById('authError').textContent = '';
}

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        if (is2FAVerified() && sessionStorage.getItem('authScreenPassed') === 'true') {
            const name = sessionStorage.getItem('userName') || user.displayName || 'Сотрудник';
            const role = sessionStorage.getItem('userRole') || 'Сотрудник отделения';
            document.getElementById('authScreen').style.display = 'none';
            document.getElementById('sidebar').style.display = 'flex';
            document.getElementById('mainContent').style.display = 'block';
            document.getElementById('displayName').textContent = name;
            document.getElementById('displayRole').textContent = role;
            document.getElementById('avatarLetter').textContent = name.charAt(0).toUpperCase();
            initData();
            renderAll();
            setTimeout(() => {
                restoreUIPosition();
                renderAll();
                loadDataFromFirestore();
            }, 100);
        } else {
            document.getElementById('authScreen').style.display = 'flex';
            document.getElementById('sidebar').style.display = 'none';
            document.getElementById('mainContent').style.display = 'none';
        }
    } else {
        currentUser = null;
        sessionStorage.removeItem('2faVerified');
        sessionStorage.removeItem('authScreenPassed');
        document.getElementById('authScreen').style.display = 'flex';
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('mainContent').style.display = 'none';
    }
});

// ================================================================
//  2. МОДАЛКИ
// ================================================================
function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('active');
    const form = modal.querySelector('form');
    if (form) form.reset();
    const success = modal.querySelector('.request-success');
    if (success) success.classList.remove('active');
    if (form) form.style.display = 'block';

    if (id === 'capacityEditModal') fillCapacityEditSelect();
    if (id === 'driverTransferModal') fillDriverTransferSelects();
    if (id === 'paymentHistoryModal') fillHistoryModal();
    if (id === 'parcelModal') setTimeout(calcParcelPrice, 100);
    if (id === 'rpoModal') setTimeout(calcRPOPrice, 100);
    if (id === 'telegramModal') {
        setTimeout(() => {
            const wc = document.getElementById('tgWordCount');
            const pd = document.getElementById('tgPriceDisplay');
            if (wc) wc.textContent = '0';
            if (pd) pd.textContent = '0';
        }, 100);
    }
    applyMasks(modal);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('active');
    });
});

// ================================================================
//  3. МАСКИ И ВАЛИДАЦИЯ
// ================================================================
function applyMasks(container) {
    if (!container) return;

    container.querySelectorAll('input[type="tel"]').forEach(el => {
        if (el._maskApplied) return;
        el._maskApplied = true;
        el.addEventListener('input', function() {
            let v = this.value.replace(/\D/g, '');
            if (v.startsWith('8')) v = '7' + v.slice(1);
            if (!v.startsWith('7')) v = '7' + v;
            v = v.slice(0, 11);
            let formatted = '+7';
            if (v.length > 1) formatted += ' ' + v.slice(1, 4);
            if (v.length > 4) formatted += ' ' + v.slice(4, 7);
            if (v.length > 7) formatted += '-' + v.slice(7, 9);
            if (v.length > 9) formatted += '-' + v.slice(9, 11);
            this.value = formatted;
        });
    });

    container.querySelectorAll('input[id*="Card"], input[id*="card"]').forEach(el => {
        if (el._maskApplied) return;
        el._maskApplied = true;
        el.addEventListener('input', function() {
            let v = this.value.replace(/\D/g, '').slice(0, 16);
            this.value = v.replace(/(\d{4})(?=\d)/g, '$1 ');
        });
    });

    container.querySelectorAll('input[id*="Expiry"], input[id*="expiry"]').forEach(el => {
        if (el._maskApplied) return;
        el._maskApplied = true;
        el.addEventListener('input', function() {
            let v = this.value.replace(/\D/g, '').slice(0, 4);
            if (v.length >= 2) this.value = v.slice(0, 2) + '/' + v.slice(2);
            else this.value = v;
        });
    });

    container.querySelectorAll('input[id*="Cvv"], input[id*="cvv"]').forEach(el => {
        if (el._maskApplied) return;
        el._maskApplied = true;
        el.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '').slice(0, 3);
        });
    });

    container.querySelectorAll('input[id*="ccount"], input[id*="Account"]').forEach(el => {
        if (el._maskApplied) return;
        el._maskApplied = true;
        el.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '').slice(0, 10);
        });
    });

    container.querySelectorAll('input[id*="nils"], input[id*="Snils"]').forEach(el => {
        if (el._maskApplied) return;
        el._maskApplied = true;
        el.addEventListener('input', function() {
            let v = this.value.replace(/\D/g, '').slice(0, 11);
            let formatted = '';
            if (v.length > 0) formatted = v.slice(0, 3);
            if (v.length > 3) formatted += '-' + v.slice(3, 6);
            if (v.length > 6) formatted += '-' + v.slice(6, 9);
            if (v.length > 9) formatted += ' ' + v.slice(9, 11);
            this.value = formatted;
        });
    });

    container.querySelectorAll('input[id*="Inn"], input[id*="inn"]').forEach(el => {
        if (el._maskApplied) return;
        el._maskApplied = true;
        el.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '').slice(0, 12);
        });
    });

    container.querySelectorAll('input[id*="assport"]').forEach(el => {
        if (el._maskApplied) return;
        el._maskApplied = true;
        el.addEventListener('input', function() {
            const id = this.id.toLowerCase();
            if (id.includes('series')) {
                let v = this.value.replace(/\D/g, '').slice(0, 4);
                if (v.length > 2) this.value = v.slice(0, 2) + ' ' + v.slice(2);
                else this.value = v;
            } else {
                this.value = this.value.replace(/\D/g, '').slice(0, 6);
            }
        });
    });
}

function luhnCheck(cardNumber) {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length !== 16) return false;
    let sum = 0;
    let alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let n = parseInt(digits[i]);
        if (alt) { n *= 2; if (n > 9) n -= 9; }
        sum += n;
        alt = !alt;
    }
    return sum % 10 === 0;
}

function isValidBin(cardNumber) {
    const first = cardNumber.replace(/\D/g, '')[0];
    return ['2', '3', '4', '5', '6'].includes(first);
}

function validateCard(cardNumber) {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length !== 16) return { valid: false, error: 'Номер карты должен содержать 16 цифр' };
    if (!isValidBin(digits)) return { valid: false, error: 'Некорректный BIN карты' };
    if (!luhnCheck(digits)) return { valid: false, error: 'Неверный номер карты (проверка Луна)' };
    return { valid: true };
}

function validateExpiry(expiry) {
    const match = expiry.match(/^(\d{2})\/(\d{2})$/);
    if (!match) return { valid: false, error: 'Формат ММ/ГГ' };
    const month = parseInt(match[1]);
    const year = parseInt('20' + match[2]);
    if (month < 1 || month > 12) return { valid: false, error: 'Месяц 01–12' };
    const now = new Date();
    const expDate = new Date(year, month, 0, 23, 59, 59);
    if (expDate < now) return { valid: false, error: 'Срок действия карты истёк' };
    return { valid: true };
}

function validateCVV(cvv) {
    if (!/^\d{3}$/.test(cvv)) return { valid: false, error: 'CVV — 3 цифры' };
    return { valid: true };
}

function validateAccount(account) {
    const digits = account.replace(/\D/g, '');
    if (digits.length !== 10) return { valid: false, error: 'Лицевой счёт — 10 цифр' };
    if (/^0+$/.test(digits)) return { valid: false, error: 'Лицевой счёт не может быть из нулей' };
    return { valid: true };
}

function validateSnils(snils) {
    const digits = snils.replace(/\D/g, '');
    if (digits.length !== 11) return { valid: false, error: 'СНИЛС — 11 цифр' };
    return { valid: true };
}

function validateInn(inn) {
    const digits = inn.replace(/\D/g, '');
    if (digits.length !== 10 && digits.length !== 12) return { valid: false, error: 'ИНН — 10 или 12 цифр' };
    return { valid: true };
}

// ================================================================
//  4. ЗАЯВКА НА ДОСТУП
// ================================================================
function submitRequest(e) {
    e.preventDefault();
    const name = document.getElementById('reqName').value.trim();
    const phone = document.getElementById('reqPhone').value.trim();
    const passportSeries = document.getElementById('reqPassportSeries').value.trim();
    const passportNumber = document.getElementById('reqPassportNumber').value.trim();
    const email = document.getElementById('reqEmail').value.trim();

    if (!name || !phone || !passportSeries || !passportNumber || !email) {
        showToast('Заполните все обязательные поля!', 'error');
        return false;
    }
    if (phone.replace(/\D/g, '').length !== 11) {
        showToast('Введите корректный телефон!', 'error');
        return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('Введите корректный email!', 'error');
        return false;
    }

    const form = document.getElementById('requestForm');
    const formData = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
    btn.disabled = true;

    fetch('https://formspree.io/f/xjyvvgbp', {
        method: 'POST', body: formData, headers: { 'Accept': 'application/json' }
    })
    .then(response => {
        if (response.ok) {
            document.getElementById('requestForm').style.display = 'none';
            document.getElementById('requestSuccess').classList.add('active');
            showToast('Заявка отправлена!', 'success');
        } else {
            showToast('Ошибка при отправке.', 'error');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    })
    .catch(() => {
        showToast('Ошибка соединения.', 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
    return false;
}

// ================================================================
//  5. КОРЗИНА
// ================================================================
function toggleCart() {
    document.getElementById('cartSidebar').classList.toggle('open');
    renderCart();
}

function addToCart(productId) {
    const product = appData.products.find(p => p.id === productId);
    if (!product) { showToast('Товар не найден!', 'error'); return; }
    if (product.qty <= 0) { showToast('Товара нет в наличии', 'error'); return; }
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        if (existing.qty >= product.qty) { showToast('Недостаточно товара!', 'error'); return; }
        existing.qty++;
        existing.total = existing.price * existing.qty;
    } else {
        cart.push({ id: productId, name: product.name, price: product.price, qty: 1, category: product.category, total: product.price });
    }
    updateCartBadge();
    renderCart();
    showToast(product.name + ' добавлен в корзину', 'success');
}

function addToCartQty(productId, qty) {
    const product = appData.products.find(p => p.id === productId);
    if (!product) { showToast('Товар не найден!', 'error'); return; }
    if (product.qty <= 0) { showToast('Товара нет в наличии', 'error'); return; }

    const existing = cart.find(item => item.id === productId);
    const currentInCart = existing ? existing.qty : 0;
    const available = product.qty - currentInCart;
    if (available <= 0) { showToast('Недостаточно товара!', 'error'); return; }

    const toAdd = Math.min(qty, available);
    if (existing) {
        existing.qty += toAdd;
        existing.total = existing.price * existing.qty;
    } else {
        cart.push({ id: productId, name: product.name, price: product.price, qty: toAdd, category: product.category, total: product.price * toAdd });
    }
    updateCartBadge();
    renderCart();
    if (toAdd < qty) showToast(`Добавлено ${toAdd} шт. (в наличии ${available})`, 'warning');
    else showToast(`Добавлено ${toAdd} шт.`, 'success');
}

function setCartItemQty(productId, qty) {
    const product = appData.products.find(p => p.id === productId);
    if (!product) return;
    qty = Math.max(1, Math.min(qty, product.qty));
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.qty = qty;
        existing.total = existing.price * qty;
    }
    updateCartBadge();
    renderCart();
}

function addToCartFromGoods() {
    const search = document.getElementById('goodsSearch')?.value?.toLowerCase() || '';
    let filtered = appData.products;
    if (goodsFilter !== 'all') {
        const map = {
            'openki': 'Немаркированные открытки', 'calendars': 'Календари',
            'konverty': 'Немаркированные конверты', 'upakovka': 'Упаковка',
            'hoztovary': 'Хозяйственные товары', 'electronics': 'Электроника', 'food': 'Питание'
        };
        filtered = filtered.filter(p => p.category === map[goodsFilter]);
    }
    if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
    if (filtered.length === 0) { showToast('Нет товаров для добавления', 'warning'); return; }

    let added = 0;
    filtered.forEach(p => {
        if (p.qty > 0) {
            const existing = cart.find(item => item.id === p.id);
            if (existing) {
                if (existing.qty < p.qty) { existing.qty++; added++; }
            } else {
                cart.push({ id: p.id, name: p.name, price: p.price, qty: 1, category: p.category, total: p.price });
                added++;
            }
        }
    });
    if (added > 0) {
        updateCartBadge();
        renderCart();
        showToast(`Добавлено ${added} товаров`, 'success');
    } else {
        showToast('Все товары уже в корзине', 'info');
    }
}

function removeItemFromCart(index) {
    if (index < cart.length) {
        cart.splice(index, 1);
        updateCartBadge();
        renderCart();
        return;
    }
    const cityIndex = index - cart.length;
    if (cityIndex >= 0 && cityIndex < cityCart.length) {
        cityCart.splice(cityIndex, 1);
        updateCityCartBadge();
        renderCart();
    }
}

function clearCart() {
    if (cart.length === 0 && cityCart.length === 0) { showToast('Корзина уже пуста', 'info'); return; }
    if (!confirm('Очистить корзину полностью?')) return;
    cart = [];
    cityCart = [];
    updateCartBadge();
    updateCityCartBadge();
    renderCart();
    showToast('Корзина очищена', 'info');
}

function updateCartBadge() {
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    const badge = document.getElementById('cartBadge');
    if (badge) badge.textContent = count;
}

function updateCityCartBadge() {
    const count = cityCart.length;
    const badge = document.getElementById('cityCartBadge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function renderCart() {
    const body = document.getElementById('cartBody');
    const totalEl = document.getElementById('cartTotal');
    if (!body || !totalEl) return;

    const allItems = [
        ...cart.map(item => ({ ...item, isCityItem: false })),
        ...cityCart.map(item => ({
            id: 'city-' + item.id,
            name: item.type === 'service' ? 'Услуга: ' + item.service : 'Кредит: ' + item.bank,
            price: item.amount || item.price || 0,
            qty: 1, isCityItem: true, cityData: item
        }))
    ];

    if (allItems.length === 0) {
        body.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:40px 0;">Корзина пуста</p>';
        totalEl.textContent = '0 ₽';
        const pb = document.querySelector('.payment-buttons');
        if (pb) pb.remove();
        return;
    }

    let total = 0;
    body.innerHTML = allItems.map((item, idx) => {
        const sum = (item.price || 0) * (item.qty || 1);
        total += sum;
        const isCity = item.isCityItem;

        if (isCity) {
            return `
                <div class="cart-item">
                    <div class="item-info">
                        <div class="item-name">${escapeHtml(item.name)}</div>
                        <div class="item-detail">${(item.price || 0).toLocaleString('ru-RU')} ₽</div>
                        <div style="font-size:10px;color:var(--accent);">🛒 Из системы "Город"</div>
                    </div>
                    <button class="item-remove" onclick="removeItemFromCart(${idx})"><i class="fas fa-minus-circle"></i></button>
                </div>
            `;
        }

        return `
            <div class="cart-item cart-item-qty">
                <div class="item-info">
                    <div class="item-name">${escapeHtml(item.name)}</div>
                    <div class="item-detail">${(item.price || 0).toLocaleString('ru-RU')} ₽ × ${item.qty} = ${sum.toLocaleString('ru-RU')} ₽</div>
                </div>
                <div class="item-qty-controls">
                    <button class="qty-btn" onclick="addToCartQty(${item.id}, 1)">+1</button>
                    <button class="qty-btn" onclick="addToCartQty(${item.id}, 5)">+5</button>
                    <button class="qty-btn" onclick="addToCartQty(${item.id}, 10)">+10</button>
                    <button class="qty-btn" onclick="addToCartQty(${item.id}, 50)">+50</button>
                    <input type="number" class="qty-input" min="1" value="${item.qty}"
                           onchange="setCartItemQty(${item.id}, parseInt(this.value) || 1)">
                    <button class="item-remove" onclick="removeItemFromCart(${idx})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
    totalEl.textContent = total.toLocaleString('ru-RU') + ' ₽';

    const footer = document.querySelector('.cart-footer');
    let paymentBtns = footer.querySelector('.payment-buttons');
    if (!paymentBtns) {
        paymentBtns = document.createElement('div');
        paymentBtns.className = 'payment-buttons';
        paymentBtns.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px;';
        paymentBtns.innerHTML = `
            <button class="btn btn-primary btn-sm" onclick="payWithQR()"><i class="fas fa-qrcode"></i> QR/СБП</button>
            <button class="btn btn-info btn-sm" onclick="payWithCard()"><i class="fas fa-credit-card"></i> Карта</button>
            <button class="btn btn-success btn-sm" onclick="payWithCash()"><i class="fas fa-money-bill-wave"></i> Наличные</button>
        `;
        footer.appendChild(paymentBtns);
    }
}

function payWithQR() {
    if (cart.length === 0 && cityCart.length === 0) { showToast('Корзина пуста!', 'warning'); return; }
    selectedPaymentMethod = 'QR-код / СБП';
    showToast('💳 Выбран способ: QR-код / СБП', 'info');
    document.querySelectorAll('.payment-buttons .btn').forEach(b => b.style.opacity = '0.5');
    document.querySelector('.payment-buttons .btn-primary')?.style.setProperty('opacity', '1', 'important');
}

function payWithCard() {
    if (cart.length === 0 && cityCart.length === 0) { showToast('Корзина пуста!', 'warning'); return; }
    selectedPaymentMethod = 'Банковская карта';
    showToast('💳 Выбран способ: Банковская карта', 'info');
    document.querySelectorAll('.payment-buttons .btn').forEach(b => b.style.opacity = '0.5');
    document.querySelector('.payment-buttons .btn-info')?.style.setProperty('opacity', '1', 'important');
}

function payWithCash() {
    if (cart.length === 0 && cityCart.length === 0) { showToast('Корзина пуста!', 'warning'); return; }
    selectedPaymentMethod = 'Наличные';
    showToast('💳 Выбран способ: Наличные', 'info');
    document.querySelectorAll('.payment-buttons .btn').forEach(b => b.style.opacity = '0.5');
    document.querySelector('.payment-buttons .btn-success')?.style.setProperty('opacity', '1', 'important');
}

function checkoutCart() {
    if (cart.length === 0 && cityCart.length === 0) { showToast('Корзина пуста!', 'warning'); return; }
    if (!selectedPaymentMethod) { showToast('⚠️ Выберите способ оплаты!', 'warning'); return; }

    let total = 0;

    [...cart].forEach(item => {
        total += item.price * item.qty;
        const product = appData.products.find(p => p.id === item.id);
        if (product) {
            product.qty -= item.qty;
            if (product.qty < 0) product.qty = 0;
            product.total = product.price * product.qty;
            if (product.qty === 0) product.status = 'Нет в наличии';
        }
        const stock = appData.goodsStock.find(g => g.name === item.name);
        if (stock) { stock.qty -= item.qty; if (stock.qty < 0) stock.qty = 0; }
        const report = appData.goodsReport.find(g => g.name === item.name);
        if (report) {
            report.outcome += item.qty;
            report.balance -= item.qty;
            if (report.balance < 0) report.balance = 0;
        }
    });

    [...cityCart].forEach(item => {
        total += item.amount || item.price || 0;
        appData.cityPayments.push({
            id: getNextId('cityPayments'),
            payer: item.payer || 'Клиент',
            service: item.type === 'service' ? item.service : 'Кредит: ' + item.bank,
            amount: item.amount || item.price || 0,
            date: item.date || new Date().toISOString().split('T')[0],
            status: 'Оплачено',
            details: item.type === 'service' ? 'Счёт: ' + item.account : 'Договор: ' + item.contract
        });
    });

    appData.cashReport.push({
        id: getNextId('cashReport'),
        operator: document.getElementById('displayName')?.textContent || 'Сотрудник',
        income: total,
        outcome: 0,
        date: new Date().toISOString().split('T')[0],
        status: 'Закрыта'
    });

    const methodText = selectedPaymentMethod;
    cart = [];
    cityCart = [];
    selectedPaymentMethod = null;
    updateCartBadge();
    updateCityCartBadge();
    saveData();
    renderAll();

    const body = document.getElementById('cartBody');
    if (body) body.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:40px 0;">Корзина пуста</p>';
    const totalEl = document.getElementById('cartTotal');
    if (totalEl) totalEl.textContent = '0 ₽';
    const pb = document.querySelector('.payment-buttons');
    if (pb) pb.remove();

    showToast(`✅ Покупка оформлена! ${methodText}. Сумма: ${total.toLocaleString('ru-RU')} ₽`, 'success');
}

// ================================================================
//  6. ДАННЫЕ
// ================================================================
function initData() {
    if (localStorage.getItem('yas_arm_data')) {
        try {
            appData = JSON.parse(localStorage.getItem('yas_arm_data'));
            const needed = ['products', 'goodsStock', 'goodsReceipt', 'goodsWriteoff', 'goodsMove',
                'goodsReturn', 'goodsUtil', 'services', 'journal', 'shiftState'];
            let needReset = false;
            needed.forEach(key => { if (!appData[key]) needReset = true; });
            if (needReset) {
                appData = getDefaultData();
                localStorage.setItem('yas_arm_data', JSON.stringify(appData));
            }
        } catch (e) {
            appData = getDefaultData();
            localStorage.setItem('yas_arm_data', JSON.stringify(appData));
        }
    } else {
        appData = getDefaultData();
        localStorage.setItem('yas_arm_data', JSON.stringify(appData));
    }
    if (currentUser) {
        setTimeout(() => loadDataFromFirestore(), 500);
    }
}

function getDefaultData() {
    const today = new Date().toISOString().split('T')[0];
    return {
        parcels: [
            { id: 1, track: 'TRK-2026-001', sender: 'Иванов И.И.', receiver: 'Петров П.П.', type: 'Посылка', weight: 2.5, status: 'Вручено', price: 450, date: '2026-06-01' },
            { id: 2, track: 'TRK-2026-002', sender: 'Сидоров С.С.', receiver: 'Козлова Е.Д.', type: 'Письмо', weight: 0.1, status: 'В пути', price: 120, date: '2026-06-05' },
            { id: 3, track: 'TRK-2026-003', sender: 'Смирнов А.В.', receiver: 'Кузнецова О.И.', type: 'Бандероль', weight: 0.8, status: 'Принято', price: 280, date: '2026-06-10' },
            { id: 4, track: 'TRK-2026-004', sender: 'Попов Д.А.', receiver: 'Морозова Н.С.', type: 'EMS', weight: 3.2, status: 'В пути', price: 890, date: '2026-06-12' },
            { id: 5, track: 'TRK-2026-005', sender: 'Васильев В.В.', receiver: 'Новикова А.И.', type: 'Посылка', weight: 1.5, status: 'Принято', price: 560, date: '2026-06-14' },
            { id: 6, track: 'TRK-2026-006', sender: 'Фёдоров Ф.Ф.', receiver: 'Соколова М.П.', type: '1-й класс', weight: 0.3, status: 'Вручено', price: 200, date: '2026-06-15' },
            { id: 7, track: 'TRK-2026-007', sender: 'Михайлов М.М.', receiver: 'Григорьева Е.В.', type: 'Бандероль', weight: 0.6, status: 'Задерживается', price: 340, date: '2026-06-16' },
            { id: 8, track: 'TRK-2026-008', sender: 'Алексеев А.А.', receiver: 'Дмитриева О.С.', type: 'Посылка', weight: 4.0, status: 'В пути', price: 1200, date: '2026-06-17' },
            { id: 9, track: 'TRK-2026-009', sender: 'Егоров Е.Е.', receiver: 'Борисова Т.Н.', type: 'Письмо', weight: 0.05, status: 'Принято', price: 70, date: '2026-06-18' },
            { id: 10, track: 'TRK-2026-010', sender: 'Николаев Н.Н.', receiver: 'Андреева И.Д.', type: 'EMS', weight: 2.8, status: 'Вручено', price: 750, date: '2026-06-19' },
        ],
        rpo: [
            { id: 1, track: 'RPO-001', type: 'Заказное письмо', sender: 'Иванов И.И.', receiver: 'Петров П.П.', value: 100, weight: 50, price: 75, status: 'В пути' },
            { id: 2, track: 'RPO-002', type: 'Ценная посылка', sender: 'Сидоров С.С.', receiver: 'Козлова Е.Д.', value: 5000, weight: 200, price: 260, status: 'Принято' },
            { id: 3, track: 'RPO-003', type: 'Бандероль', sender: 'Смирнов А.В.', receiver: 'Кузнецова О.И.', value: 350, weight: 80, price: 64, status: 'Сортировка' },
        ],
        services: [
            { id: 1, name: 'Упаковка подарочная', price: 150, desc: 'Красивая упаковка' },
            { id: 2, name: 'Страхование', price: 0, desc: '0.5% от стоимости' },
            { id: 3, name: 'СМС-уведомление', price: 35, desc: 'Уведомление о статусе' },
            { id: 4, name: 'Доставка на дом', price: 200, desc: 'Курьерская доставка' },
            { id: 5, name: 'Электронная подпись', price: 150, desc: 'Подтверждение ЭП' },
        ],
        products: [
            { id: 1, name: 'Открытка "С днём рождения"', category: 'Немаркированные открытки', qty: 50, price: 25, total: 1250, status: 'В наличии' },
            { id: 2, name: 'Открытка "С Новым годом"', category: 'Немаркированные открытки', qty: 30, price: 30, total: 900, status: 'В наличии' },
            { id: 3, name: 'Календарь настенный 2027', category: 'Календари', qty: 15, price: 200, total: 3000, status: 'В наличии' },
            { id: 4, name: 'Календарь карманный', category: 'Календари', qty: 40, price: 50, total: 2000, status: 'В наличии' },
            { id: 5, name: 'Конверт С6', category: 'Немаркированные конверты', qty: 80, price: 15, total: 1200, status: 'В наличии' },
            { id: 6, name: 'Конверт С4', category: 'Немаркированные конверты', qty: 25, price: 35, total: 875, status: 'В наличии' },
            { id: 7, name: 'Упаковка "Подарочная"', category: 'Упаковка', qty: 12, price: 150, total: 1800, status: 'В наличии' },
            { id: 8, name: 'Упаковка "Стандарт"', category: 'Упаковка', qty: 20, price: 80, total: 1600, status: 'В наличии' },
            { id: 9, name: 'Скрепки канцелярские', category: 'Хозяйственные товары', qty: 100, price: 5, total: 500, status: 'В наличии' },
            { id: 10, name: 'Скотч широкий', category: 'Хозяйственные товары', qty: 30, price: 45, total: 1350, status: 'В наличии' },
            { id: 11, name: 'Батарейки AA (4 шт.)', category: 'Электроника', qty: 25, price: 120, total: 3000, status: 'В наличии' },
            { id: 12, name: 'Батарейки AAA (4 шт.)', category: 'Электроника', qty: 20, price: 100, total: 2000, status: 'В наличии' },
            { id: 13, name: 'Печенье "Юбилейное"', category: 'Питание', qty: 15, price: 85, total: 1275, status: 'В наличии' },
            { id: 14, name: 'Печенье "Овсяное"', category: 'Питание', qty: 10, price: 95, total: 950, status: 'В наличии' },
            { id: 15, name: 'Шоколад "Алёнка"', category: 'Питание', qty: 20, price: 110, total: 2200, status: 'В наличии' },
            { id: 16, name: 'SIM-карта Мегафон', category: 'Электроника', qty: 8, price: 250, total: 2000, status: 'В наличии' },
            { id: 17, name: 'SIM-карта МТС', category: 'Электроника', qty: 6, price: 250, total: 1500, status: 'В наличии' },
            { id: 18, name: 'SIM-карта Билайн', category: 'Электроника', qty: 5, price: 250, total: 1250, status: 'В наличии' },
            { id: 19, name: 'Зарядное устройство', category: 'Электроника', qty: 10, price: 350, total: 3500, status: 'В наличии' },
            { id: 20, name: 'Флешка 16GB', category: 'Электроника', qty: 7, price: 400, total: 2800, status: 'В наличии' },
            { id: 21, name: 'Наушники проводные', category: 'Электроника', qty: 5, price: 500, total: 2500, status: 'В наличии' },
            { id: 22, name: 'Блокнот А5', category: 'Хозяйственные товары', qty: 35, price: 120, total: 4200, status: 'В наличии' },
            { id: 23, name: 'Ручка шариковая (синяя)', category: 'Хозяйственные товары', qty: 200, price: 15, total: 3000, status: 'В наличии' },
            { id: 24, name: 'Карандаш простой', category: 'Хозяйственные товары', qty: 150, price: 10, total: 1500, status: 'В наличии' },
            { id: 25, name: 'Ластик', category: 'Хозяйственные товары', qty: 80, price: 20, total: 1600, status: 'В наличии' },
            { id: 26, name: 'Папка-конверт А4', category: 'Упаковка', qty: 45, price: 55, total: 2475, status: 'В наличии' },
            { id: 27, name: 'Скрепки 50 шт.', category: 'Хозяйственные товары', qty: 120, price: 8, total: 960, status: 'В наличии' },
            { id: 28, name: 'Клей-карандаш', category: 'Хозяйственные товары', qty: 60, price: 35, total: 2100, status: 'В наличии' },
            { id: 29, name: 'Ножницы канцелярские', category: 'Хозяйственные товары', qty: 25, price: 85, total: 2125, status: 'В наличии' },
            { id: 30, name: 'Файл-вкладыш А4', category: 'Упаковка', qty: 300, price: 2, total: 600, status: 'В наличии' },
        ],
        goodsStock: [
            { id: 1, name: 'Открытка "С днём рождения"', category: 'Немаркированные открытки', qty: 150, warehouse: 'Склад №1' },
            { id: 2, name: 'Календарь настенный 2027', category: 'Календари', qty: 25, warehouse: 'Склад №1' },
            { id: 3, name: 'Конверт С6', category: 'Немаркированные конверты', qty: 200, warehouse: 'Склад №1' },
            { id: 4, name: 'Упаковка "Подарочная"', category: 'Упаковка', qty: 18, warehouse: 'Склад №2' },
            { id: 5, name: 'Скрепки канцелярские', category: 'Хозяйственные товары', qty: 250, warehouse: 'Склад №2' },
            { id: 6, name: 'Батарейки AA', category: 'Электроника', qty: 100, warehouse: 'Склад №2' },
            { id: 7, name: 'Печенье "Юбилейное"', category: 'Питание', qty: 50, warehouse: 'Склад №1' },
            { id: 8, name: 'Блокнот А5', category: 'Хозяйственные товары', qty: 35, warehouse: 'Склад №2' },
            { id: 9, name: 'Ручка шариковая', category: 'Хозяйственные товары', qty: 200, warehouse: 'Склад №2' },
            { id: 10, name: 'Папка-конверт А4', category: 'Упаковка', qty: 45, warehouse: 'Склад №1' },
            { id: 11, name: 'Клей-карандаш', category: 'Хозяйственные товары', qty: 60, warehouse: 'Склад №1' },
            { id: 12, name: 'Файл-вкладыш А4', category: 'Упаковка', qty: 300, warehouse: 'Склад №2' },
        ],
        goodsReceipt: [
            { id: 1, name: 'Конверт С6', category: 'Немаркированные конверты', qty: 100, price: 12, date: '2026-06-15', user: 'Иванов И.И.' },
        ],
        goodsWriteoff: [
            { id: 1, name: 'Скрепки канцелярские', category: 'Хозяйственные товары', qty: 15, date: '2026-06-14', user: 'Сидоров С.С.' },
        ],
        goodsMove: [
            { id: 1, name: 'Календарь настенный 2027', from: 'Склад №1', to: 'Склад №2', qty: 5, date: '2026-06-16' },
        ],
        goodsReturn: [
            { id: 1, name: 'Конверт С6', client: 'Петров П.П.', amount: 150, date: '2026-06-17', status: 'Оформлен' },
        ],
        goodsUtil: [
            { id: 1, name: 'Старые журналы', qty: 20, date: '2026-06-10', user: 'Иванов И.И.' },
        ],
        delivery: [
            { id: 1, track: 'TRK-2026-001', receiver: 'Петров П.П.', sender: 'Иванов И.И.', type: 'Посылка', status: 'Вручено', date: '2026-06-04' },
            { id: 2, track: 'TRK-2026-002', receiver: 'Козлова Е.Д.', sender: 'Сидоров С.С.', type: 'Письмо', status: 'Ожидает', date: '2026-06-05' },
        ],
        deliveryReturn: [
            { id: 1, track: 'TRK-2026-003', sender: 'Смирнов А.В.', receiver: 'Кузнецова О.И.', senderAddress: 'г. Москва, ул. Ленина, д.10', receiverAddress: 'г. Москва, ул. Тверская, д.15', date: '2026-06-18', status: 'В обработке' },
        ],
        lottery: [
            { id: 1, ticket: 'LT-001', client: 'Иванов И.И.', amount: 100, date: '2026-06-20', status: 'Выигрыш' },
        ],
        insurance: [
            { id: 1, policy: 'INS-001', client: 'Иванов И.И.', passportSeries: '12 34', passportNumber: '567890', birthdate: '1980-01-01', amount: 5000, date: '2026-06-15', status: 'Активен' },
        ],
        sim: [
            { id: 1, sim: 'SIM-001', phone: '+7 999 123-45-67', owner: 'Иванов И.И.', tariff: 'Безлимитный', status: 'Активна' },
        ],
        digital: [
            { id: 1, service: 'Электронная подпись', client: 'ООО "Ромашка"', price: 1500, date: '2026-06-20', status: 'Активна' },
        ],
        telegram: [
            { id: 1, sender: 'Иванов И.И.', senderAddress: 'г. Москва, ул. Ленина, д.10', receiver: 'Петров П.П.', receiverAddress: 'г. Москва, ул. Тверская, д.15', text: 'Поздравляю с днём рождения!', words: 4, price: 20, date: '2026-06-20', status: 'Отправлена' },
        ],
        copy: [
            { id: 1, client: 'Иванов И.И.', type: 'Ч/б копия', qty: 10, price: 50, date: '2026-06-20' },
        ],
        pension: [
            { id: 1, name: 'Иванова М.И.', snils: '123-456-789 00', amount: 18500, type: 'Пенсия', date: '2026-06-20', status: 'Выплачено' },
        ],
        cityPayments: [
            { id: 1, payer: 'Иванов И.И.', service: 'Телефон', amount: 450, date: '2026-06-20', status: 'Оплачено' },
        ],
        utilityPayments: [
            { id: 1, payer: 'Иванов И.И.', service: 'Электроэнергия', amount: 1230, date: '2026-06-18', status: 'Оплачено' },
        ],
        withdrawHistory: [
            { id: 1, client: 'Иванов И.И.', amount: 5000, date: '2026-06-20', status: 'Выполнено' },
        ],
        depositHistory: [
            { id: 1, client: 'Сидоров С.С.', amount: 10000, date: '2026-06-20', status: 'Зачислено' },
        ],
        incoming: [
            { id: 1, track: 'IN-001', sender: 'Почта России', date: '2026-06-18', type: 'Посылка', status: 'На сортировке' },
        ],
        documents: [
            { id: 1, number: 'АКТ-001', type: 'Акт', sender: 'Почта России', date: '2026-06-18' },
        ],
        capacity: [
            { id: 1, name: 'Емкость №1', items: 'TRK-001, TRK-002', weight: 8.5, status: 'Готова' },
        ],
        invoice: [
            { id: 1, number: 'Ф23-001', type: 'Ф23', creator: 'Иванов И.И.', date: '2026-06-20', status: 'Готово' },
        ],
        driver: [
            { id: 1, driver: 'Иванов И.И.', transport: 'ГАЗ-3302', capacities: 3, invoices: 'Ф23-001', status: 'Передано' },
        ],
        postmanTasks: [
            { id: 1, name: 'Иванов Иван', route: 'Маршрут №1', count: 45, addresses: 'ул. Ленина, ул. Советская', notes: '', status: 'Выполняется' },
        ],
        storageJournal: [
            { id: 1, track: 'TRK-2026-001', receiver: 'Петров П.П.', sender: 'Иванов И.И.', date: '2026-06-04', status: 'Вручено' },
        ],
        addressStorage: [
            { id: 1, cell: 'A-01', track: 'TRK-2026-003', receiver: 'Кузнецова О.И.', term: '2026-07-01', status: 'Хранится' },
        ],
        returnForward: [
            { id: 1, track: 'TRK-2026-007', sender: 'Иванов И.И.', receiver: '—', operation: 'Возврат' },
        ],
        cashReport: [
            { id: 1, operator: 'Иванов И.И.', income: 15200, outcome: 5000, date: '2026-06-20', status: 'Закрыта' },
            { id: 2, operator: 'Петров П.П.', income: 8200, outcome: 3000, date: '2026-06-21', status: 'Закрыта' },
        ],
        report2ap: [],
        rpoReport: [
            { track: 'RPO-001', type: 'Заказное письмо', sender: 'Иванов И.И.', receiver: 'Петров П.П.', date: '2026-06-01', status: 'Вручено' },
        ],
        goodsReport: [
            { id: 1, name: 'Открытка "С днём рождения"', income: 50, outcome: 25, balance: 25 },
        ],
        serviceCash: [
            { 
                id: 1, 
                operator: 'Сотрудник', 
                income: 0, 
                outcome: 0, 
                date: today, 
                openTime: new Date().toISOString(),
                closeTime: null,
                status: 'Открыта' 
            },
        ],
        incidents: [],
        journal: [],
        shiftState: {
            isOpen: true,
            currentShiftId: 1,
            lastCloseTime: null,
            lastOpenTime: new Date().toISOString()
        },
        currentId: {
            parcels: 11, rpo: 4, products: 31, goodsStock: 13, goodsReceipt: 2, goodsWriteoff: 2,
            goodsMove: 2, goodsReturn: 2, goodsUtil: 2, delivery: 3, deliveryReturn: 2,
            lottery: 2, insurance: 2, sim: 2, digital: 2, telegram: 2, copy: 2,
            pension: 2, cityPayments: 2, utilityPayments: 2, withdrawHistory: 2,
            depositHistory: 2, incoming: 2, documents: 2, capacity: 2, invoice: 2,
            driver: 2, postmanTasks: 2, storageJournal: 2, addressStorage: 2,
            returnForward: 2, cashReport: 3, incidents: 1, services: 6, goodsReport: 2,
            journal: 1, serviceCash: 2
        }
    };
}

function saveData() {
    localStorage.setItem('yas_arm_data', JSON.stringify(appData));
    if (currentUser) {
        saveDataToFirestore().catch(err => console.warn('Firestore save error:', err));
    }
}

function getNextId(key) {
    if (!appData.currentId) appData.currentId = {};
    if (!appData.currentId[key]) appData.currentId[key] = 1;
    return appData.currentId[key]++;
}

// ================================================================
//  7. СТАТУСЫ
// ================================================================
const STATUS_FLOW = {
    'Принято': ['Сортировка', 'В пути', 'Отменено'],
    'Сортировка': ['В пути', 'Прибыло', 'Возврат'],
    'В пути': ['Прибыло', 'Задерживается', 'Возврат'],
    'Прибыло': ['Готово к вручению', 'Возврат', 'Досыл'],
    'Готово к вручению': ['Вручено', 'Возврат', 'Досыл'],
    'Задерживается': ['В пути', 'Прибыло', 'Возврат'],
    'Вручено': [],
    'Возврат': ['В пути', 'Принято'],
    'Досыл': ['В пути'],
    'Отменено': []
};

const STATUS_LABELS = {
    'Принято': { badge: 'badge-info', icon: 'fa-inbox' },
    'Сортировка': { badge: 'badge-warning', icon: 'fa-sort' },
    'В пути': { badge: 'badge-primary', icon: 'fa-truck' },
    'Прибыло': { badge: 'badge-info', icon: 'fa-warehouse' },
    'Готово к вручению': { badge: 'badge-accent', icon: 'fa-bell' },
    'Задерживается': { badge: 'badge-danger', icon: 'fa-clock' },
    'Вручено': { badge: 'badge-success', icon: 'fa-check-circle' },
    'Возврат': { badge: 'badge-warning', icon: 'fa-undo' },
    'Досыл': { badge: 'badge-info', icon: 'fa-forward' },
    'Отменено': { badge: 'badge-danger', icon: 'fa-times-circle' }
};

function canTransition(fromStatus, toStatus) {
    const allowed = STATUS_FLOW[fromStatus];
    if (!allowed) return false;
    return allowed.includes(toStatus);
}

function getAvailableTransitions(currentStatus) {
    return STATUS_FLOW[currentStatus] || [];
}

// ================================================================
//  8. СМЕНА
// ================================================================
function getShiftState() {
    if (!appData.shiftState) {
        appData.shiftState = {
            isOpen: true,
            currentShiftId: 1,
            lastCloseTime: null,
            lastOpenTime: new Date().toISOString()
        };
    }
    return appData.shiftState;
}

function canOpenShift() {
    const state = getShiftState();
    const now = new Date();
    if (state.isOpen) return { allowed: false, reason: 'Смена уже открыта' };
    if (state.lastCloseTime) {
        const lastClose = new Date(state.lastCloseTime);
        const hoursSinceClose = (now - lastClose) / (1000 * 60 * 60);
        if (hoursSinceClose < SHIFT_POLICY.minRestHours) {
            const nextAvailable = new Date(lastClose.getTime() + SHIFT_POLICY.minRestHours * 60 * 60 * 1000);
            return {
                allowed: false,
                reason: `Открыть смену можно не раньше ${nextAvailable.toLocaleString('ru-RU')} (перерыв ${SHIFT_POLICY.minRestHours} ч)`
            };
        }
    }
    return { allowed: true };
}

function canCloseShift() {
    const state = getShiftState();
    if (!state.isOpen) return { allowed: false, reason: 'Смена не открыта' };
    return { allowed: true };
}

function openShift() {
    const check = canOpenShift();
    if (!check.allowed) { showToast('⛔ ' + check.reason, 'error'); return; }

    const state = getShiftState();
    const now = new Date();
    shiftNumber = (appData.serviceCash?.length || 0) + 1;

    const newShift = {
        id: getNextId('serviceCash'),
        operator: document.getElementById('displayName')?.textContent || 'Сотрудник',
        income: 0, outcome: 0,
        date: now.toISOString().split('T')[0],
        openTime: now.toISOString(),
        closeTime: null,
        status: 'Открыта'
    };
    appData.serviceCash.push(newShift);

    state.isOpen = true;
    state.currentShiftId = newShift.id;
    state.lastOpenTime = now.toISOString();
    shiftOpen = true;

    saveData();
    updateServiceStats();
    renderServiceCash();
    showToast(`✅ Смена #${shiftNumber} открыта`, 'success');
}

function closeShift() {
    const check = canCloseShift();
    if (!check.allowed) { showToast('⛔ ' + check.reason, 'error'); return; }
    if (!confirm('Закрыть смену? После закрытия открыть новую можно будет не раньше чем через ' + SHIFT_POLICY.minRestHours + ' ч.')) return;

    const state = getShiftState();
    const now = new Date();
    const currentShift = appData.serviceCash.find(s => s.id === state.currentShiftId);
    if (!currentShift) { showToast('Ошибка: смена не найдена', 'error'); return; }

    const income = Math.floor(Math.random() * 50000) + 10000;
    const outcome = Math.floor(Math.random() * 10000) + 1000;
    const hours = ((now - new Date(currentShift.openTime)) / (1000 * 60 * 60)).toFixed(1);
    const transactions = Math.floor(Math.random() * 30) + 5;

    currentShift.income = income;
    currentShift.outcome = outcome;
    currentShift.status = 'Закрыта';
    currentShift.closeTime = now.toISOString();
    currentShift.duration = hours;
    currentShift.transactions = transactions;

    state.isOpen = false;
    state.currentShiftId = null;
    state.lastCloseTime = now.toISOString();
    shiftOpen = false;

    const nextOpen = new Date(now.getTime() + SHIFT_POLICY.minRestHours * 60 * 60 * 1000);

    saveData();
    updateServiceStats();
    renderServiceCash();

    showToast(`🔒 Смена #${shiftNumber} закрыта`, 'info');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-window">
            <h3><i class="fas fa-file-alt" style="color:var(--accent);"></i> Отчёт о закрытии смены #${shiftNumber}</h3>
            <div class="shift-report">
                <div class="shift-stat"><span class="label">Дата:</span><span class="value">${new Date().toLocaleDateString('ru-RU')}</span></div>
                <div class="shift-stat"><span class="label">Открыта:</span><span class="value">${new Date(currentShift.openTime).toLocaleTimeString('ru-RU')}</span></div>
                <div class="shift-stat"><span class="label">Закрыта:</span><span class="value">${now.toLocaleTimeString('ru-RU')}</span></div>
                <div class="shift-stat"><span class="label">Продолжительность:</span><span class="value">${hours} ч</span></div>
                <div class="shift-stat"><span class="label">Операций:</span><span class="value">${transactions}</span></div>
                <div class="shift-stat"><span class="label">Приход:</span><span class="value" style="color:var(--success);">${income.toLocaleString('ru-RU')} ₽</span></div>
                <div class="shift-stat"><span class="label">Расход:</span><span class="value" style="color:var(--danger);">${outcome.toLocaleString('ru-RU')} ₽</span></div>
                <div class="shift-stat"><span class="label">Итог:</span><span class="value" style="color:var(--accent);">${(income - outcome).toLocaleString('ru-RU')} ₽</span></div>
                <div style="margin-top:12px;padding:12px;background:var(--warning-light);border-radius:var(--radius-sm);font-size:13px;">
                    ⚠️ Следующая смена не раньше <strong>${nextOpen.toLocaleString('ru-RU')}</strong>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-check"></i> Понятно</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function processCollection() {
    const state = getShiftState();
    if (!state.isOpen) { showToast('Смена не открыта!', 'error'); return; }
    const amount = Math.floor(Math.random() * 50000) + 20000;
    showToast('Инкассация: ' + amount.toLocaleString('ru-RU') + ' ₽', 'success');
    const currentShift = appData.serviceCash.find(s => s.id === state.currentShiftId);
    if (currentShift) {
        currentShift.income += amount;
        saveData();
        updateServiceStats();
    }
}

function resetShiftForDebug() {
    if (!confirm('Сбросить смену? Только для отладки.')) return;
    appData.serviceCash = appData.serviceCash.filter(s => s.status !== 'Закрыта');
    const newId = getNextId('serviceCash');
    appData.serviceCash.push({
        id: newId,
        operator: document.getElementById('displayName')?.textContent || 'Сотрудник',
        income: 0, outcome: 0,
        date: new Date().toISOString().split('T')[0],
        openTime: new Date().toISOString(),
        closeTime: null,
        status: 'Открыта'
    });
    appData.shiftState = {
        isOpen: true,
        currentShiftId: newId,
        lastCloseTime: null,
        lastOpenTime: new Date().toISOString()
    };
    shiftOpen = true;
    saveData();
    updateServiceStats();
    renderServiceCash();
    showToast('Смена сброшена', 'success');
}

function updateServiceStats() {
    const state = getShiftState();
    const currentShift = state.currentShiftId ? appData.serviceCash.find(s => s.id === state.currentShiftId) : null;
    const cash1 = currentShift ? (currentShift.income || 0) : 0;
    const cash2 = currentShift ? (currentShift.outcome || 0) : 0;
    const el1 = document.getElementById('serviceCash1');
    const el2 = document.getElementById('serviceCash2');
    const elShift = document.getElementById('serviceShift');
    const elStatus = document.getElementById('serviceStatus');
    if (el1) el1.textContent = cash1.toLocaleString('ru-RU') + ' ₽';
    if (el2) el2.textContent = cash2.toLocaleString('ru-RU') + ' ₽';
    if (elShift) elShift.textContent = '#' + (state.currentShiftId || '—');
    if (elStatus) {
        elStatus.textContent = state.isOpen ? 'Открыта' : 'Закрыта';
        elStatus.style.color = state.isOpen ? 'var(--success)' : 'var(--danger)';
    }
}

// ================================================================
//  9. УТИЛИТЫ
// ================================================================
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', warning: 'fa-exclamation-circle' };
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${escapeHtml(message)}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(60px)';
        toast.style.transition = 'all 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function deleteItem(key, id) {
    if (!confirm('Удалить запись?')) return;
    appData[key] = appData[key].filter(item => item.id !== id);
    saveData();
    renderAll();
    showToast('Запись удалена', 'info');
}

// ================================================================
//  10. РАСЧЁТЫ
// ================================================================
function calcParcelPrice() {
    const type = document.getElementById('pType')?.value || 'Посылка';
    const weight = parseFloat(document.getElementById('pWeight')?.value) || 0;
    let price = 0;
    switch(type) {
        case 'Письмо': price = 30 + weight * 0.3; break;
        case 'Бандероль': price = 40 + weight * 0.5; break;
        case 'Посылка': price = 80 + weight * 0.8; break;
        case '1-й класс': price = 70 + weight * 0.6; break;
        case 'EMS': price = 180 + weight * 1.2; break;
        default: price = 50 + weight * 0.5;
    }
    const total = Math.round(price * 100) / 100;
    const priceField = document.getElementById('pPrice');
    if (priceField) priceField.value = total.toFixed(2);
    return total;
}

function calcRPOPrice() {
    const type = document.getElementById('rpoType')?.value || 'Заказное письмо';
    const weight = parseFloat(document.getElementById('rpoWeight')?.value) || 0;
    const value = parseFloat(document.getElementById('rpoValue')?.value) || 0;
    let basePrice = 0;
    switch(type) {
        case 'Заказное письмо': basePrice = 50 + weight * 0.5; break;
        case 'Ценная посылка': basePrice = 100 + weight * 0.8; break;
        case 'Бандероль': basePrice = 40 + weight * 0.3; break;
        case 'EMS': basePrice = 200 + weight * 1.5; break;
        case '1-й класс': basePrice = 80 + weight * 0.7; break;
        default: basePrice = 50 + weight * 0.5;
    }
    const valueFee = value * 0.01;
    const total = Math.round((basePrice + valueFee) * 100) / 100;
    const priceField = document.getElementById('rpoPrice');
    if (priceField) priceField.value = total.toFixed(2);
    return total;
}

function calcTelegramPrice() {
    const text = document.getElementById('tgText')?.value || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const price = words * 5;
    const wc = document.getElementById('tgWordCount');
    const pd = document.getElementById('tgPriceDisplay');
    if (wc) wc.textContent = words;
    if (pd) pd.textContent = price;
    return price;
}
function trWithDate(date, innerHtml) {
    const d = date ? ` data-date="${escapeHtml(date)}"` : '';
    return `<tr${d}>${innerHtml}</tr>`;
}

// ================================================================
//  11. РЕНДЕРИНГ — ПОСЫЛКИ
// ================================================================
function renderParcels() {
    const search = document.getElementById('parcelSearch')?.value?.toLowerCase() || '';
    let filtered = appData.parcels || [];
    if (search) filtered = filtered.filter(p =>
        p.track.toLowerCase().includes(search) || p.sender.toLowerCase().includes(search)
    );
    const tbody = document.getElementById('parcelsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    filtered.forEach(p => {
        const statusInfo = STATUS_LABELS[p.status] || { badge: 'badge-info', icon: 'fa-circle' };
        const transitions = getAvailableTransitions(p.status);
        const nextStatus = transitions.length > 0 ? transitions[0] : null;
        const tr = document.createElement('tr');
        tr.setAttribute('data-date', p.date || '');
        tr.innerHTML = `
            <td><strong>${escapeHtml(p.track)}</strong></td>
            <td>${escapeHtml(p.sender)}</td>
            <td>${escapeHtml(p.receiver)}</td>
            <td>${escapeHtml(p.type)}</td>
            <td>${p.weight} кг</td>
            <td><span class="badge ${statusInfo.badge}"><i class="fas ${statusInfo.icon}"></i> ${p.status}</span></td>
            <td>
                ${nextStatus ? `<button class="btn btn-success btn-xs" onclick="advanceStatus(${p.id}, '${nextStatus}')"><i class="fas fa-arrow-right"></i> ${nextStatus}</button>` : '<span style="font-size:11px;color:var(--gray-400);">—</span>'}
                <button class="btn btn-info btn-xs" onclick="showStatusHistory(${p.id})"><i class="fas fa-history"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function advanceStatus(parcelId, newStatus) {
    const parcel = appData.parcels.find(p => p.id === parcelId);
    if (!parcel) return;
    if (!canTransition(parcel.status, newStatus)) {
        showToast(`⛔ Нельзя: "${parcel.status}" → "${newStatus}"`, 'error');
        return;
    }
    if (!confirm(`Перевести ${parcel.track} в "${newStatus}"?`)) return;
    if (!parcel.history) parcel.history = [];
    parcel.history.push({
        from: parcel.status, to: newStatus,
        at: new Date().toISOString(),
        by: document.getElementById('displayName')?.textContent || 'Сотрудник'
    });
    parcel.status = newStatus;
    if (newStatus === 'Вручено') {
        parcel.deliveredAt = new Date().toISOString();
        appData.delivery.push({
            id: getNextId('delivery'),
            track: parcel.track,
            receiver: parcel.receiver,
            sender: parcel.sender,
            type: parcel.type,
            status: 'Вручено',
            date: new Date().toISOString().split('T')[0]
        });
    }
    saveData();
    renderParcels();
    renderDelivery();
    showToast(`Статус: ${newStatus}`, 'success');
}

function showStatusHistory(parcelId) {
    const parcel = appData.parcels.find(p => p.id === parcelId);
    if (!parcel) return;
    const history = parcel.history || [];
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-window">
            <h3><i class="fas fa-history" style="color:var(--info);"></i> История: ${escapeHtml(parcel.track)}</h3>
            <p class="modal-sub">Текущий статус: <strong>${parcel.status}</strong></p>
            ${history.length === 0 ? '<p style="color:var(--gray-500);">История пуста</p>' : `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr><th>Было</th><th>Стало</th><th>Когда</th><th>Кто</th></tr></thead>
                        <tbody>
                            ${history.map(h => `
                                <tr>
                                    <td>${h.from}</td>
                                    <td><strong>${h.to}</strong></td>
                                    <td>${new Date(h.at).toLocaleString('ru-RU')}</td>
                                    <td>${escapeHtml(h.by)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function saveParcel(e) {
    e.preventDefault();
    const track = 'TRK-2026-' + String((appData.parcels?.length || 0) + 1).padStart(3, '0');
    const price = calcParcelPrice();
    appData.parcels.push({
        id: getNextId('parcels'),
        track, sender: document.getElementById('pSender').value.trim(),
        receiver: document.getElementById('pReceiver').value.trim(),
        type: document.getElementById('pType').value,
        weight: parseFloat(document.getElementById('pWeight').value) || 0,
        status: 'Принято',
        price,
        date: new Date().toISOString().split('T')[0],
        history: [{ from: '—', to: 'Принято', at: new Date().toISOString(), by: document.getElementById('displayName')?.textContent || 'Сотрудник' }]
    });
    cart.push({
        id: 'parcel-' + Date.now(),
        name: 'Отправление: ' + track + ' (' + document.getElementById('pType').value + ')',
        category: 'Почтовые отправления',
        qty: 1, price, total: price, status: 'В корзине'
    });
    updateCartBadge();
    renderCart();
    saveData();
    closeModal('parcelModal');
    renderParcels();
    showToast('Принято! ' + price.toFixed(2) + ' ₽', 'success');
    return false;
}

// ================================================================
//  12. RPO
// ================================================================
function renderRPO() {
    const tbody = document.getElementById('rpoTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.rpo || appData.rpo.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    appData.rpo.forEach(r => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-date', r.date || '');
        tr.innerHTML = `
            <td><strong>${escapeHtml(r.track)}</strong></td>
            <td>${escapeHtml(r.type)}</td>
            <td>${escapeHtml(r.sender)}</td>
            <td>${escapeHtml(r.receiver)}</td>
            <td>${r.weight || 0} г</td>
            <td>${r.value || 0} ₽</td>
            <td>${r.price || 0} ₽</td>
            <td><span class="badge badge-info">${escapeHtml(r.status)}</span></td>
        `;
        tbody.appendChild(tr);
    });
}


function saveRPO(e) {
    e.preventDefault();
    const track = document.getElementById('rpoTrack').value.trim();
    const type = document.getElementById('rpoType').value;
    const sender = document.getElementById('rpoSender').value.trim();
    const receiver = document.getElementById('rpoReceiver').value.trim();
    const weight = parseFloat(document.getElementById('rpoWeight').value) || 0;
    const value = parseFloat(document.getElementById('rpoValue').value) || 0;
    const price = calcRPOPrice();
    if (!track || !sender || !receiver) { showToast('Заполните поля!', 'error'); return false; }
    if (weight <= 0) { showToast('Введите вес!', 'error'); return false; }
    cart.push({
        id: 'rpo-' + Date.now(),
        name: 'РПО: ' + type + ' (' + track + ')',
        category: 'Почтовые отправления',
        qty: 1, price, total: price, status: 'В корзине',
        track, type, sender, receiver, weight, value
    });
    updateCartBadge();
    renderCart();
    appData.rpo.push({
        id: getNextId('rpo'), track, type, sender, receiver,
        weight, value, price, status: 'В корзине'
    });
    saveData();
    closeModal('rpoModal');
    renderRPO();
    showToast('РПО в корзине! ' + price.toFixed(2) + ' ₽', 'success');
    return false;
}

function getExportPeriod(buttonEl, tableId) {
    let from = null, to = null;
    let scope = null;

    // 1) ближайший .toolbar от кнопки
    if (buttonEl) {
        scope = buttonEl.closest('.toolbar');
    }

    // 2) если не нашли — ищем в контейнере с таблицей
    if (!scope && tableId) {
        const t = document.getElementById(tableId);
        if (t) scope = t.closest('.tab-content, .sub-tab-content, .card, .page-section, .tabs-container');
    }

    // 3) fallback — активная вкладка
    if (!scope) {
        scope = document.querySelector('.sub-tab-content.active, .tab-content.active, .page-section.active');
    }

    if (scope) {
        const pb = scope.querySelector('.export-period');
        if (pb) {
            from = pb.querySelector('.export-date-from')?.value || null;
            to   = pb.querySelector('.export-date-to')?.value   || null;
        }
    }
    return { from, to };
}

// ================================================================
//  13. УСЛУГИ
// ================================================================
function renderServices() {
    const tbody = document.getElementById('extraServicesBody');
    if (!tbody) return;
    tbody.innerHTML = (appData.services || []).map(s => `
        <tr>
            <td>${s.id}</td>
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td>${s.price} ₽</td>
            <td>${escapeHtml(s.desc || '—')}</td>
            <td><button class="btn btn-accent btn-xs" onclick="addExtraServiceToCart(${s.id})"><i class="fas fa-shopping-cart"></i></button></td>
        </tr>
    `).join('');
}

function addExtraServiceToCart(serviceId) {
    const service = appData.services.find(s => s.id === serviceId);
    if (!service) return;
    extraCart.push({ ...service });
    updateExtraCartInfo();
    showToast('Услуга "' + service.name + '" добавлена', 'success');
}

function addExtraToCart() {
    if (extraCart.length === 0) { showToast('Нет услуг', 'warning'); return; }
    extraCart.forEach(s => {
        cart.push({
            id: 'extra-' + Date.now() + '-' + s.id,
            name: 'Услуга: ' + s.name,
            category: 'Услуги',
            qty: 1, price: s.price, total: s.price, status: 'В корзине'
        });
    });
    const total = extraCart.reduce((sum, s) => sum + s.price, 0);
    extraCart = [];
    updateExtraCartInfo();
    updateCartBadge();
    renderCart();
    showToast('Услуги: ' + total.toLocaleString('ru-RU') + ' ₽', 'success');
}

function updateExtraCartInfo() {
    const info = document.getElementById('extraServiceCartInfo');
    const count = document.getElementById('extraCartCount');
    const total = document.getElementById('extraCartTotal');
    if (!info || !count || !total) return;
    const sum = extraCart.reduce((s, item) => s + item.price, 0);
    count.textContent = extraCart.length;
    total.textContent = sum.toLocaleString('ru-RU');
    info.style.display = extraCart.length > 0 ? 'block' : 'none';
}

function saveExtraService(e) {
    e.preventDefault();
    const name = document.getElementById('esName').value.trim();
    const price = parseFloat(document.getElementById('esPrice').value) || 0;
    const desc = document.getElementById('esDesc').value.trim();
    if (!name) { showToast('Введите название!', 'error'); return false; }
    appData.services.push({ id: getNextId('services'), name, price, desc: desc || '—' });
    saveData();
    closeModal('extraServiceModal');
    renderServices();
    showToast('Услуга добавлена', 'success');
    return false;
}

// ================================================================
//  14. ТОВАРЫ
// ================================================================
function renderGoods() {
    const search = document.getElementById('goodsSearch')?.value?.toLowerCase() || '';
    let filtered = appData.products || [];
    if (goodsFilter !== 'all') {
        const map = {
            'openki': 'Немаркированные открытки', 'calendars': 'Календари',
            'konverty': 'Немаркированные конверты', 'upakovka': 'Упаковка',
            'hoztovary': 'Хозяйственные товары', 'electronics': 'Электроника', 'food': 'Питание'
        };
        filtered = filtered.filter(p => p.category === map[goodsFilter]);
    }
    if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
    const tbody = document.getElementById('goodsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--gray-500);">Нет товаров</td></tr>`;
        return;
    }
    filtered.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.id}</td>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td><span class="badge badge-info">${escapeHtml(p.category)}</span></td>
            <td>${p.qty}</td>
            <td>${p.price} ₽</td>
            <td>${p.total} ₽</td>
            <td><span class="badge ${p.status === 'В наличии' ? 'badge-success' : 'badge-danger'}">${p.status}</span></td>
            <td>
                <button class="btn btn-accent btn-xs" onclick="addToCart(${p.id})"><i class="fas fa-plus"></i></button>
                <button class="btn btn-success btn-xs" onclick="addToCartQty(${p.id}, 5)">+5</button>
                <button class="btn btn-success btn-xs" onclick="addToCartQty(${p.id}, 10)">+10</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterGoods(filter) {
    goodsFilter = filter;
    document.querySelectorAll('.filter-buttons .filter-btn').forEach(b => b.classList.remove('active'));
    if (window.event?.target) window.event.target.classList.add('active');
    renderGoods();
}

function saveProduct(e) {
    e.preventDefault();
    const name = document.getElementById('prodName').value.trim();
    const category = document.getElementById('prodCategory').value;
    const qty = parseInt(document.getElementById('prodQty').value) || 1;
    const price = parseFloat(document.getElementById('prodPrice').value) || 0;
    if (!name) { showToast('Введите наименование!', 'error'); return false; }
    appData.products.push({
        id: getNextId('products'), name, category, qty, price,
        total: qty * price, status: 'В наличии'
    });
    appData.goodsStock.push({
        id: getNextId('goodsStock'), name, category, qty, warehouse: 'Склад №1'
    });
    saveData();
    closeModal('productModal');
    renderAll();
    showToast('Товар добавлен!', 'success');
    return false;
}

function renderGoodsStock() {
    const tbody = document.getElementById('goodsStockBody');
    if (!tbody) return;
    if (!appData.goodsStock || appData.goodsStock.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    let totalQty = 0, totalValue = 0;
    let html = '';
    appData.goodsStock.forEach(g => {
        totalQty += g.qty || 0;
        const product = appData.products.find(p => p.name === g.name);
        const price = product ? product.price : 0;
        const value = (g.qty || 0) * price;
        totalValue += value;
        html += `
            <tr>
                <td>${g.id}</td>
                <td><strong>${escapeHtml(g.name)}</strong></td>
                <td><span class="badge badge-info">${escapeHtml(g.category)}</span></td>
                <td><strong>${g.qty}</strong></td>
                <td>${escapeHtml(g.warehouse)}</td>
                <td>${value.toLocaleString('ru-RU')} ₽</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    const footer = document.getElementById('goodsStockFooter');
    if (footer) {
        footer.innerHTML = `
            <tr>
                <td colspan="3" style="text-align:right;font-size:14px;">ИТОГО:</td>
                <td style="font-size:14px;color:var(--primary);font-weight:700;">${totalQty} шт.</td>
                <td></td>
                <td style="font-size:14px;color:var(--accent);font-weight:700;">${totalValue.toLocaleString('ru-RU')} ₽</td>
            </tr>
        `;
    }
}

function refreshStock() { renderGoodsStock(); showToast('Обновлено!', 'success'); }

function renderGoodsReceipt() {
    const tbody = document.getElementById('goodsReceiptBody');
    if (!tbody) return;
    if (!appData.goodsReceipt || appData.goodsReceipt.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.goodsReceipt.map(r => `
        <tr>
            <td>${r.id}</td>
            <td><strong>${escapeHtml(r.name)}</strong></td>
            <td><span class="badge badge-info">${escapeHtml(r.category)}</span></td>
            <td>${r.qty}</td>
            <td>${r.price} ₽</td>
            <td>${r.date}</td>
            <td>${escapeHtml(r.user || '—')}</td>
        </tr>
    `).join('');
}

function saveGoodsReceipt(e) {
    e.preventDefault();
    const name = document.getElementById('grName').value.trim();
    const category = document.getElementById('grCategory').value;
    const qty = parseInt(document.getElementById('grQty').value) || 0;
    const price = parseFloat(document.getElementById('grPrice').value) || 0;
    if (!name || qty <= 0) { showToast('Заполните поля!', 'error'); return false; }
    appData.goodsReceipt.push({
        id: getNextId('goodsReceipt'), name, category, qty, price,
        date: new Date().toISOString().split('T')[0],
        user: document.getElementById('displayName')?.textContent || 'Сотрудник'
    });
    const stock = appData.goodsStock.find(g => g.name === name);
    if (stock) stock.qty += qty;
    else appData.goodsStock.push({ id: getNextId('goodsStock'), name, category, qty, warehouse: 'Склад №1' });
    saveData();
    closeModal('goodsReceiptModal');
    renderAll();
    showToast('Оприходовано!', 'success');
    return false;
}

function renderGoodsWriteoff() {
    const tbody = document.getElementById('goodsWriteoffBody');
    if (!tbody) return;
    if (!appData.goodsWriteoff || appData.goodsWriteoff.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.goodsWriteoff.map(w => `
        <tr>
            <td>${w.id}</td>
            <td><strong>${escapeHtml(w.name)}</strong></td>
            <td><span class="badge badge-info">${escapeHtml(w.category)}</span></td>
            <td>${w.qty}</td>
            <td>${w.date}</td>
            <td>${escapeHtml(w.user || '—')}</td>
        </tr>
    `).join('');
}

function saveGoodsWriteoff(e) {
    e.preventDefault();
    const name = document.getElementById('woName').value.trim();
    const category = document.getElementById('woCategory').value;
    const qty = parseInt(document.getElementById('woQty').value) || 0;
    const reason = document.getElementById('woReason').value.trim();
    if (!name || qty <= 0) { showToast('Заполните поля!', 'error'); return false; }
    appData.goodsWriteoff.push({
        id: getNextId('goodsWriteoff'), name, category, qty,
        date: new Date().toISOString().split('T')[0],
        user: document.getElementById('displayName')?.textContent || 'Сотрудник',
        reason: reason || 'Не указана'
    });
    const stock = appData.goodsStock.find(g => g.name === name);
    if (stock) { stock.qty -= qty; if (stock.qty < 0) stock.qty = 0; }
    saveData();
    closeModal('goodsWriteoffModal');
    renderAll();
    showToast('Списано!', 'success');
    return false;
}

function renderGoodsMove() {
    const tbody = document.getElementById('goodsMoveBody');
    if (!tbody) return;
    if (!appData.goodsMove || appData.goodsMove.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.goodsMove.map(m => `
        <tr>
            <td>${m.id}</td>
            <td><strong>${escapeHtml(m.name)}</strong></td>
            <td>${escapeHtml(m.from)}</td>
            <td>${escapeHtml(m.to)}</td>
            <td>${m.qty}</td>
            <td>${m.date}</td>
        </tr>
    `).join('');
}

function saveGoodsMove(e) {
    e.preventDefault();
    const name = document.getElementById('gmName').value.trim();
    const from = document.getElementById('gmFrom').value.trim();
    const to = document.getElementById('gmTo').value.trim();
    const qty = parseInt(document.getElementById('gmQty').value) || 0;
    if (!name || !from || !to || qty <= 0) { showToast('Заполните поля!', 'error'); return false; }
    appData.goodsMove.push({
        id: getNextId('goodsMove'), name, from, to, qty,
        date: new Date().toISOString().split('T')[0]
    });
    const stockFrom = appData.goodsStock.find(g => g.name === name && g.warehouse === from);
    const stockTo = appData.goodsStock.find(g => g.name === name && g.warehouse === to);
    if (stockFrom) { stockFrom.qty -= qty; if (stockFrom.qty < 0) stockFrom.qty = 0; }
    if (stockTo) stockTo.qty += qty;
    else appData.goodsStock.push({
        id: getNextId('goodsStock'), name,
        category: appData.products.find(p => p.name === name)?.category || 'Другое',
        qty, warehouse: to
    });
    saveData();
    closeModal('goodsMoveModal');
    renderAll();
    showToast('Перемещено!', 'success');
    return false;
}

function startInventory() {
    const result = document.getElementById('inventoryResult');
    if (!result) return;
    const totalItems = appData.goodsStock.reduce((sum, g) => sum + g.qty, 0);
    const totalValue = appData.goodsStock.reduce((sum, g) => {
        const product = appData.products.find(p => p.name === g.name);
        return sum + (g.qty * (product?.price || 0));
    }, 0);
    result.innerHTML = `
        <div style="background:var(--success-light);padding:20px;border-radius:var(--radius-sm);border:1px solid var(--success);">
            <h4 style="color:var(--success-dark);"><i class="fas fa-check-circle"></i> Инвентаризация завершена</h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:12px;">
                <div style="background:white;padding:12px;border-radius:var(--radius-sm);text-align:center;">
                    <div style="font-size:11px;color:var(--gray-500);">Наименований</div>
                    <div style="font-size:20px;font-weight:700;color:var(--primary);">${appData.goodsStock.length}</div>
                </div>
                <div style="background:white;padding:12px;border-radius:var(--radius-sm);text-align:center;">
                    <div style="font-size:11px;color:var(--gray-500);">Количество</div>
                    <div style="font-size:20px;font-weight:700;color:var(--primary);">${totalItems} шт.</div>
                </div>
                <div style="background:white;padding:12px;border-radius:var(--radius-sm);text-align:center;">
                    <div style="font-size:11px;color:var(--gray-500);">Стоимость</div>
                    <div style="font-size:20px;font-weight:700;color:var(--accent);">${totalValue.toLocaleString('ru-RU')} ₽</div>
                </div>
            </div>
        </div>
    `;
    showToast('Инвентаризация завершена', 'success');
}

function renderGoodsReturn() {
    const tbody = document.getElementById('goodsReturnBody');
    if (!tbody) return;
    if (!appData.goodsReturn || appData.goodsReturn.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.goodsReturn.map(r => `
        <tr>
            <td>${r.id}</td>
            <td><strong>${escapeHtml(r.name)}</strong></td>
            <td>${escapeHtml(r.client)}</td>
            <td>${r.amount} ₽</td>
            <td>${r.date}</td>
            <td><span class="badge ${r.status === 'Оформлен' ? 'badge-success' : 'badge-warning'}">${r.status}</span></td>
        </tr>
    `).join('');
}

function saveGoodsReturn(e) {
    e.preventDefault();
    const client = document.getElementById('grClient').value.trim();
    const name = document.getElementById('grReturnName').value.trim();
    const amount = parseFloat(document.getElementById('grReturnAmount').value) || 0;
    const reason = document.getElementById('grReturnReason').value.trim();
    if (!client || !name || amount <= 0) { showToast('Заполните поля!', 'error'); return false; }
    appData.goodsReturn.push({
        id: getNextId('goodsReturn'), client, name, amount,
        date: new Date().toISOString().split('T')[0],
        status: 'Оформлен', reason: reason || 'Не указана'
    });
    saveData();
    closeModal('goodsReturnModal');
    renderAll();
    showToast('Возврат оформлен', 'success');
    return false;
}

function renderGoodsUtil() {
    const tbody = document.getElementById('goodsUtilBody');
    if (!tbody) return;
    if (!appData.goodsUtil || appData.goodsUtil.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.goodsUtil.map(u => `
        <tr>
            <td>${u.id}</td>
            <td><strong>${escapeHtml(u.name)}</strong></td>
            <td>${u.qty}</td>
            <td>${u.date}</td>
            <td>${escapeHtml(u.user || '—')}</td>
        </tr>
    `).join('');
}

function saveGoodsUtil(e) {
    e.preventDefault();
    const name = document.getElementById('utName').value.trim();
    const qty = parseInt(document.getElementById('utQty').value) || 0;
    const reason = document.getElementById('utReason').value.trim();
    if (!name || qty <= 0) { showToast('Заполните поля!', 'error'); return false; }
    appData.goodsUtil.push({
        id: getNextId('goodsUtil'), name, qty,
        date: new Date().toISOString().split('T')[0],
        user: document.getElementById('displayName')?.textContent || 'Сотрудник',
        reason: reason || 'Не указана'
    });
    saveData();
    closeModal('goodsUtilModal');
    renderAll();
    showToast('Утилизировано', 'success');
    return false;
}

// ================================================================
//  15. ВРУЧЕНИЕ
// ================================================================
function renderDelivery() {
    const tbody = document.getElementById('deliveryBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.delivery || appData.delivery.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    appData.delivery.forEach(d => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-date', d.date || '');
        tr.innerHTML = `
            <td><strong>${escapeHtml(d.track)}</strong></td>
            <td>${escapeHtml(d.receiver)}</td>
            <td>${escapeHtml(d.sender || '—')}</td>
            <td>${escapeHtml(d.type)}</td>
            <td><span class="badge ${d.status === 'Вручено' ? 'badge-success' : 'badge-warning'}">${d.status}</span></td>
            <td>${d.date || '—'}</td>
            <td>${d.status !== 'Вручено' ? `<button class="btn btn-accent btn-xs" onclick="confirmDelivery(${d.id})"><i class="fas fa-check"></i></button>` : '<i class="fas fa-check-circle" style="color:var(--success);"></i>'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function saveDelivery(e) {
    e.preventDefault();
    const track = document.getElementById('delTrack').value.trim();
    const receiver = document.getElementById('delReceiver').value.trim();
    const sender = document.getElementById('delSender').value.trim();
    const address = document.getElementById('delAddress').value.trim();
    const senderAddress = document.getElementById('delSenderAddress').value.trim();
    if (!track || !receiver || !sender) { showToast('Заполните поля!', 'error'); return false; }
    const parcel = appData.parcels.find(p => p.track === track);
    if (!parcel) { showToast('Трек не найден!', 'error'); return false; }
    if (parcel.status !== 'Готово к вручению') {
        showToast(`⛔ Нельзя вручить. Статус: "${parcel.status}". Нужно "Готово к вручению".`, 'error');
        return false;
    }
    if (!parcel.history) parcel.history = [];
    parcel.history.push({
        from: parcel.status, to: 'Вручено',
        at: new Date().toISOString(),
        by: document.getElementById('displayName')?.textContent || 'Сотрудник'
    });
    parcel.status = 'Вручено';
    appData.delivery.push({
        id: getNextId('delivery'), track, receiver, sender,
        type: parcel.type, status: 'Вручено',
        date: new Date().toISOString().split('T')[0],
        address, senderAddress
    });
    saveData();
    closeModal('deliveryModal');
    renderAll();
    showToast('Вручено!', 'success');
    return false;
}

function confirmDelivery(id) {
    const item = appData.delivery.find(d => d.id === id);
    if (item) {
        item.status = 'Вручено';
        item.date = new Date().toISOString().split('T')[0];
        saveData();
        renderDelivery();
        showToast('Подтверждено', 'success');
    }
}

// ================================================================
//  16. ВОЗВРАТ ВРУЧЕНИЯ
// ================================================================
function renderDeliveryReturn() {
    const tbody = document.getElementById('deliveryReturnBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.deliveryReturn || appData.deliveryReturn.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    appData.deliveryReturn.forEach(d => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-date', d.date || '');
        tr.innerHTML = `
            <td><strong>${escapeHtml(d.track)}</strong></td>
            <td>${escapeHtml(d.sender)}</td>
            <td>${escapeHtml(d.receiver)}</td>
            <td>${escapeHtml(d.senderAddress || '—')}</td>
            <td>${escapeHtml(d.receiverAddress || '—')}</td>
            <td>${d.date || '—'}</td>
            <td><span class="badge badge-warning">${d.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function saveDeliveryReturn(e) {
    e.preventDefault();
    const track = document.getElementById('drTrack').value.trim();
    const sender = document.getElementById('drSender').value.trim();
    const receiver = document.getElementById('drReceiver').value.trim();
    const senderAddress = document.getElementById('drSenderAddress').value.trim();
    const receiverAddress = document.getElementById('drReceiverAddress').value.trim();
    const reason = document.getElementById('drReason').value.trim();
    if (!track || !sender || !receiver) { showToast('Заполните поля!', 'error'); return false; }
    appData.deliveryReturn.push({
        id: getNextId('deliveryReturn'), track, sender, receiver,
        senderAddress: senderAddress || '—',
        receiverAddress: receiverAddress || '—',
        date: new Date().toISOString().split('T')[0],
        status: 'В обработке', reason
    });
    saveData();
    closeModal('deliveryReturnModal');
    renderDeliveryReturn();
    showToast('Возврат оформлен', 'success');
    return false;
}

// ================================================================
//  17. ЛОТЕРЕИ
// ================================================================
function renderLottery() {
    const tbody = document.getElementById('lotteryBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.lottery || appData.lottery.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    appData.lottery.forEach(l => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-date', l.date || '');
        tr.innerHTML = `
            <td>${escapeHtml(l.ticket)}</td>
            <td>${escapeHtml(l.client)}</td>
            <td>${l.amount} ₽</td>
            <td>${l.date || '—'}</td>
            <td><span class="badge ${l.status === 'Выигрыш' ? 'badge-success' : 'badge-warning'}">${l.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function saveLotterySale(e) {
    e.preventDefault();
    const client = document.getElementById('lsClient').value.trim();
    const count = parseInt(document.getElementById('lsCount').value) || 1;
    const price = parseFloat(document.getElementById('lsPrice').value) || 100;
    const date = document.getElementById('lsDate').value || new Date().toISOString().split('T')[0];
    if (!client) { showToast('Введите клиента!', 'error'); return false; }
    for (let i = 0; i < count; i++) {
        appData.lottery.push({
            id: getNextId('lottery'),
            ticket: 'LT-' + String(appData.lottery.length + 1).padStart(3, '0'),
            client, amount: price, date, status: 'Принят'
        });
    }
    saveData();
    closeModal('lotterySaleModal');
    renderLottery();
    showToast('Продано!', 'success');
    return false;
}

function saveLotteryPay(e) {
    e.preventDefault();
    const client = document.getElementById('lpClient').value.trim();
    const ticket = document.getElementById('lpTicket').value.trim();
    const amount = parseFloat(document.getElementById('lpAmount').value) || 0;
    if (!client || !ticket) { showToast('Заполните поля!', 'error'); return false; }
    const item = appData.lottery.find(l => l.ticket === ticket);
    if (item) { item.status = 'Выигрыш'; item.amount = amount; }
    else appData.lottery.push({
        id: getNextId('lottery'), ticket, client, amount,
        date: new Date().toISOString().split('T')[0], status: 'Выигрыш'
    });
    saveData();
    closeModal('lotteryPayModal');
    renderLottery();
    showToast('Выплачено!', 'success');
    return false;
}

function generateLotteryReport() {
    const total = appData.lottery.reduce((s, l) => s + l.amount, 0);
    const wins = appData.lottery.filter(l => l.status === 'Выигрыш').length;
    const el = document.getElementById('lotteryReport');
    if (el) {
        el.innerHTML = `
            <div style="background:var(--success-light);padding:16px;border-radius:var(--radius-sm);color:#1a7a3a;margin-bottom:12px;">
                <i class="fas fa-chart-bar"></i> <strong>Отчёт:</strong>
                <ul style="margin-top:8px;list-style:none;">
                    <li>✅ Билетов: ${appData.lottery.length}</li>
                    <li>💰 Выручка: ${total} ₽</li>
                    <li>🏆 Выигрышей: ${wins}</li>
                </ul>
            </div>
        `;
    }
    showToast('Отчёт сформирован', 'success');
}

// ================================================================
//  18. СТРАХОВКИ
// ================================================================
function renderInsurance() {
    const tbody = document.getElementById('insuranceBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.insurance || appData.insurance.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    appData.insurance.forEach(i => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-date', i.date || '');
        tr.innerHTML = `
            <td>${escapeHtml(i.policy)}</td>
            <td>${escapeHtml(i.client)}</td>
            <td>${escapeHtml(i.passportSeries || '—')} ${escapeHtml(i.passportNumber || '—')}</td>
            <td>${i.birthdate || '—'}</td>
            <td>${i.amount} ₽</td>
            <td>${i.date || '—'}</td>
            <td><span class="badge ${i.status === 'Активен' ? 'badge-success' : 'badge-warning'}">${i.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function saveInsurance(e) {
    e.preventDefault();
    const client = document.getElementById('insClient').value.trim();
    const passportSeries = document.getElementById('insPassportSeries').value.trim();
    const passportNumber = document.getElementById('insPassportNumber').value.trim();
    const birthdate = document.getElementById('insBirthdate').value;
    const amount = parseFloat(document.getElementById('insAmount').value) || 0;
    const type = document.getElementById('insType').value;
    if (!client || !passportSeries || !passportNumber) { showToast('Заполните поля!', 'error'); return false; }
    appData.insurance.push({
        id: getNextId('insurance'),
        policy: 'INS-' + String(appData.insurance.length + 1).padStart(3, '0'),
        client, passportSeries, passportNumber,
        birthdate: birthdate || '—', amount, type,
        date: new Date().toISOString().split('T')[0], status: 'Активен'
    });
    saveData();
    closeModal('insuranceModal');
    renderInsurance();
    showToast('Оформлено!', 'success');
    return false;
}

// ================================================================
//  19. SIM
// ================================================================
function renderSIM() {
    const tbody = document.getElementById('simBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.sim || appData.sim.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    appData.sim.forEach(s => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-date', s.date || new Date().toISOString().split('T')[0]);
        tr.innerHTML = `
            <td>${escapeHtml(s.sim)}</td>
            <td>${escapeHtml(s.phone)}</td>
            <td>${escapeHtml(s.operator || '—')}</td>
            <td>${escapeHtml(s.tariff)}</td>
            <td><span class="badge ${s.status === 'Активна' ? 'badge-success' : 'badge-warning'}">${s.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function saveSIM(e) {
    e.preventDefault();
    const operator = document.getElementById('simOperator').value;
    const phone = document.getElementById('simPhone').value.trim();
    const owner = document.getElementById('simOwner').value.trim();
    const tariff = document.getElementById('simTariff').value;
    if (!operator || !phone || !owner) { showToast('Заполните поля!', 'error'); return false; }
    if (phone.replace(/\D/g, '').length !== 11) { showToast('Введите корректный телефон!', 'error'); return false; }
    appData.sim.push({
        id: getNextId('sim'),
        sim: 'SIM-' + String(appData.sim.length + 1).padStart(3, '0'),
        phone, operator, owner, tariff, status: 'Активна'
    });
    saveData();
    closeModal('simModal');
    renderSIM();
    showToast('Активирована!', 'success');
    return false;
}

// ================================================================
//  20. ЦИФРОВЫЕ СЕРВИСЫ
// ================================================================
function renderDigital() {
    const tbody = document.getElementById('digitalBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.digital || appData.digital.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    appData.digital.forEach(d => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-date', d.date || '');
        tr.innerHTML = `
            <td><strong>${escapeHtml(d.service)}</strong></td>
            <td>${escapeHtml(d.client)}</td>
            <td>${d.price} ₽</td>
            <td>${d.date || '—'}</td>
            <td><span class="badge ${d.status === 'Активна' ? 'badge-success' : 'badge-warning'}">${d.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function saveDigital(e) {
    e.preventDefault();
    const client = document.getElementById('digClient').value.trim();
    const service = document.getElementById('digService').value;
    const price = parseFloat(document.getElementById('digPrice').value) || 0;
    if (!client || !service) { showToast('Заполните поля!', 'error'); return false; }
    appData.digital.push({
        id: getNextId('digital'), client, service, price,
        date: new Date().toISOString().split('T')[0], status: 'Активна'
    });
    saveData();
    closeModal('digitalModal');
    renderDigital();
    showToast('Подключено!', 'success');
    return false;
}

// ================================================================
//  21. ТЕЛЕГРАММЫ
// ================================================================
function renderTelegram() {
    const tbody = document.getElementById('telegramBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.telegram || appData.telegram.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    appData.telegram.forEach(t => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-date', t.date || '');
        tr.innerHTML = `
            <td>${t.id}</td>
            <td>${escapeHtml(t.sender)}</td>
            <td>${escapeHtml(t.senderAddress || '—')}</td>
            <td>${escapeHtml(t.receiver)}</td>
            <td>${escapeHtml(t.receiverAddress || '—')}</td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.text || '—')}</td>
            <td>${t.words || 0}</td>
            <td>${t.price || 0} ₽</td>
            <td>${t.date || '—'}</td>
            <td><span class="badge ${t.status === 'Отправлена' ? 'badge-success' : 'badge-warning'}">${t.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function saveTelegram(e) {
    e.preventDefault();
    const sender = document.getElementById('tgSender').value.trim();
    const senderAddress = document.getElementById('tgSenderAddress').value.trim();
    const receiver = document.getElementById('tgReceiver').value.trim();
    const receiverAddress = document.getElementById('tgReceiverAddress').value.trim();
    const text = document.getElementById('tgText').value.trim();
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const price = words * 5;
    if (!sender || !senderAddress || !receiver || !receiverAddress || !text) {
        showToast('Заполните поля!', 'error');
        return false;
    }
    appData.telegram.push({
        id: getNextId('telegram'), sender, senderAddress, receiver,
        receiverAddress, text, words, price,
        date: new Date().toISOString().split('T')[0], status: 'Отправлена'
    });
    saveData();
    closeModal('telegramModal');
    renderTelegram();
    showToast('Отправлено! ' + price + ' ₽', 'success');
    return false;
}

// ================================================================
//  22. КОПИИ
// ================================================================
function renderCopy() {
    const tbody = document.getElementById('copyBody');
    if (!tbody) return;
    if (!appData.copy || appData.copy.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.copy.map(c => `
        <tr>
            <td>${c.id}</td>
            <td>${escapeHtml(c.client)}</td>
            <td>${escapeHtml(c.type)}</td>
            <td>${c.qty}</td>
            <td>${c.price} ₽</td>
            <td>${c.date}</td>
        </tr>
    `).join('');
}

function saveCopy(e) {
    e.preventDefault();
    const client = document.getElementById('copyClient').value.trim();
    const type = document.getElementById('copyType').value;
    const qty = parseInt(document.getElementById('copyQty').value) || 1;
    const price = parseFloat(document.getElementById('copyPrice').value) || 10;
    if (!client) { showToast('Введите клиента!', 'error'); return false; }
    appData.copy.push({
        id: getNextId('copy'), client, type, qty,
        price: qty * price, date: new Date().toISOString().split('T')[0]
    });
    saveData();
    closeModal('copyModal');
    renderCopy();
    showToast('Создано!', 'success');
    return false;
}

// ================================================================
//  23. ПЕНСИИ
// ================================================================
function renderPension() {
    const tbody = document.getElementById('pensionBody');
    if (!tbody) return;
    if (!appData.pension || appData.pension.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.pension.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.snils)}</td>
            <td>${p.amount} ₽</td>
            <td>${escapeHtml(p.type)}</td>
            <td>${p.date}</td>
            <td><span class="badge ${p.status === 'Выплачено' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
        </tr>
    `).join('');
}

function savePension(e) {
    e.preventDefault();
    const name = document.getElementById('pensName').value.trim();
    const snils = document.getElementById('pensSnils').value.trim();
    const address = document.getElementById('pensAddress').value.trim();
    const amount = parseFloat(document.getElementById('pensAmount').value) || 0;
    const type = document.getElementById('pensType').value;
    if (!name || !snils || !address) { showToast('Заполните поля!', 'error'); return false; }
    const snilsCheck = validateSnils(snils);
    if (!snilsCheck.valid) { showToast('❌ ' + snilsCheck.error, 'error'); return false; }
    appData.pension.push({
        id: getNextId('pension'), name, snils, address, amount, type,
        date: new Date().toISOString().split('T')[0], status: 'Назначено'
    });
    saveData();
    closeModal('pensionModal');
    renderPension();
    showToast('Назначено!', 'success');
    return false;
}

// ================================================================
//  24. СИСТЕМА ГОРОД
// ================================================================
function renderCityPayments() {
    const tbody = document.getElementById('cityPaymentsBody');
    if (!tbody) return;
    if (!appData.cityPayments || appData.cityPayments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.cityPayments.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${escapeHtml(p.payer)}</td>
            <td>${escapeHtml(p.service)}</td>
            <td>${p.amount} ₽</td>
            <td>${p.date}</td>
            <td><span class="badge ${p.status === 'Оплачено' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
        </tr>
    `).join('');
}

function savePhonePayment(e) {
    e.preventDefault();
    const phone = document.getElementById('phoneNumber').value.trim();
    const amount = parseFloat(document.getElementById('phoneAmount').value) || 0;
    const operator = document.getElementById('phoneOperator').value;
    if (!phone || phone.replace(/\D/g, '').length !== 11) { showToast('Введите корректный телефон!', 'error'); return false; }
    if (!amount) { showToast('Введите сумму!', 'error'); return false; }
    appData.cityPayments.push({
        id: getNextId('cityPayments'), payer: phone,
        service: 'Телефон (' + operator + ')', amount,
        date: new Date().toISOString().split('T')[0], status: 'Оплачено'
    });
    saveData();
    closeModal('paymentPhoneModal');
    renderCityPayments();
    showToast('Оплачено!', 'success');
    return false;
}

function saveTrashPayment(e) {
    e.preventDefault();
    const account = document.getElementById('trashAccount').value.trim();
    const amount = parseFloat(document.getElementById('trashAmount').value) || 0;
    const check = validateAccount(account);
    if (!check.valid) { showToast('❌ ' + check.error, 'error'); return false; }
    if (!amount) { showToast('Введите сумму!', 'error'); return false; }
    appData.cityPayments.push({
        id: getNextId('cityPayments'), payer: account,
        service: 'Мусор', amount,
        date: new Date().toISOString().split('T')[0], status: 'Оплачено'
    });
    saveData();
    closeModal('paymentTrashModal');
    renderCityPayments();
    showToast('Оплачено!', 'success');
    return false;
}

function saveFinePayment(e) {
    e.preventDefault();
    const number = document.getElementById('fineNumber').value.trim();
    const amount = parseFloat(document.getElementById('fineAmount').value) || 0;
    const type = document.getElementById('fineType').value;
    if (!number || !amount) { showToast('Заполните поля!', 'error'); return false; }
    appData.cityPayments.push({
        id: getNextId('cityPayments'), payer: number,
        service: 'Штраф (' + type + ')', amount,
        date: new Date().toISOString().split('T')[0], status: 'Оплачено'
    });
    saveData();
    closeModal('paymentFineModal');
    renderCityPayments();
    showToast('Оплачено!', 'success');
    return false;
}

function saveTaxPayment(e) {
    e.preventDefault();
    const inn = document.getElementById('taxInn').value.trim();
    const type = document.getElementById('taxType').value;
    const amount = parseFloat(document.getElementById('taxAmount').value) || 0;
    const period = document.getElementById('taxPeriod').value;
    const check = validateInn(inn);
    if (!check.valid) { showToast('❌ ' + check.error, 'error'); return false; }
    if (!amount) { showToast('Введите сумму!', 'error'); return false; }
    appData.cityPayments.push({
        id: getNextId('cityPayments'), payer: inn,
        service: 'Налог (' + type + ') - ' + period, amount,
        date: new Date().toISOString().split('T')[0], status: 'Оплачено'
    });
    saveData();
    closeModal('paymentTaxModal');
    renderCityPayments();
    showToast('Оплачено!', 'success');
    return false;
}

// ================================================================
//  25. КОММУНАЛКА
// ================================================================
function payUtilityNew() {
    const account = document.getElementById('utilityAccount').value.trim();
    const payer = document.getElementById('utilityPayer').value.trim();
    const service = document.getElementById('utilityService')?.value || 'Коммунальные услуги';
    const amount = document.getElementById('utilPayAmount').value;

    const accCheck = validateAccount(account);
    if (!accCheck.valid) { showToast('❌ ' + accCheck.error, 'error'); return; }
    if (!payer) { showToast('Введите ФИО!', 'error'); return; }
    if (!amount || parseFloat(amount) <= 0) { showToast('Введите сумму!', 'error'); return; }

    appData.utilityPayments.push({
        id: getNextId('utilityPayments'),
        payer, service: service + ' (счёт: ' + account + ')',
        amount: parseFloat(amount),
        date: new Date().toISOString().split('T')[0],
        status: 'Оплачено'
    });
    saveData();
    renderUtilityPayments();
    showToast('Оплачено! ' + parseFloat(amount).toLocaleString('ru-RU') + ' ₽', 'success');
    document.getElementById('utilPayAmount').value = '';
    document.getElementById('utilityAccount').value = '';
    document.getElementById('utilityPayer').value = '';
}

function renderUtilityPayments() {
    const tbody = document.getElementById('utilityPaymentsBody');
    if (!tbody) return;
    if (!appData.utilityPayments || appData.utilityPayments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.utilityPayments.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${escapeHtml(p.payer)}</td>
            <td>${escapeHtml(p.service)}</td>
            <td>${p.amount} ₽</td>
            <td>${p.date}</td>
            <td><span class="badge ${p.status === 'Оплачено' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
        </tr>
    `).join('');
}

// ================================================================
//  26. КАРТЫ
// ================================================================
function checkBalance() {
    const card = document.getElementById('balanceCard').value.trim();
    const expiry = document.getElementById('balanceExpiry').value.trim();
    const cvv = document.getElementById('balanceCvv').value.trim();
    const result = document.getElementById('balanceResult');

    const cardCheck = validateCard(card);
    if (!cardCheck.valid) {
        result.style.display = 'block';
        result.className = 'result-box error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + cardCheck.error;
        return;
    }
    const expCheck = validateExpiry(expiry);
    if (!expCheck.valid) {
        result.style.display = 'block';
        result.className = 'result-box error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + expCheck.error;
        return;
    }
    const cvvCheck = validateCVV(cvv);
    if (!cvvCheck.valid) {
        result.style.display = 'block';
        result.className = 'result-box error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + cvvCheck.error;
        return;
    }

    const balance = Math.floor(Math.random() * 50000) + 1000;
    result.style.display = 'block';
    result.className = 'result-box success';
    result.innerHTML = `<i class="fas fa-check-circle"></i> <strong>Баланс: ${balance.toLocaleString('ru-RU')} ₽</strong>`;
    showToast('Баланс получен!', 'success');
}

function processWithdraw() {
    const card = document.getElementById('withdrawCard').value.trim();
    const amount = document.getElementById('withdrawAmount').value;
    const name = document.getElementById('withdrawName').value.trim();
    const result = document.getElementById('withdrawResult');

    const cardCheck = validateCard(card);
    if (!cardCheck.valid) {
        result.style.display = 'block';
        result.className = 'result-box error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + cardCheck.error;
        return;
    }
    if (!amount || parseInt(amount) <= 0) {
        result.style.display = 'block';
        result.className = 'result-box error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> Введите сумму';
        return;
    }
    if (!name) {
        result.style.display = 'block';
        result.className = 'result-box error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> Введите ФИО';
        return;
    }

    result.style.display = 'block';
    result.className = 'result-box success';
    result.innerHTML = `<i class="fas fa-check-circle"></i> <strong>Снятие выполнено!</strong><div style="font-size:14px;font-weight:400;">${parseInt(amount).toLocaleString('ru-RU')} ₽ · ${escapeHtml(name)}</div>`;
    appData.withdrawHistory.push({
        id: getNextId('withdrawHistory'), client: name,
        amount: parseInt(amount),
        date: new Date().toISOString().split('T')[0], status: 'Выполнено'
    });
    saveData();
    renderWithdrawHistory();
    showToast('Снятие выполнено!', 'success');
}

function processDeposit() {
    const card = document.getElementById('depositCard').value.trim();
    const amount = document.getElementById('depositAmount').value;
    const name = document.getElementById('depositName').value.trim();
    const method = document.getElementById('depositMethod').value;
    const result = document.getElementById('depositResult');

    const cardCheck = validateCard(card);
    if (!cardCheck.valid) {
        result.style.display = 'block';
        result.className = 'result-box error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + cardCheck.error;
        return;
    }
    if (!amount || parseInt(amount) <= 0) {
        result.style.display = 'block';
        result.className = 'result-box error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> Введите сумму';
        return;
    }

    result.style.display = 'block';
    result.className = 'result-box success';
    result.innerHTML = `<i class="fas fa-check-circle"></i> <strong>Зачисление выполнено!</strong><div style="font-size:14px;font-weight:400;">${parseInt(amount).toLocaleString('ru-RU')} ₽ · ${escapeHtml(method)}</div>`;
    appData.depositHistory.push({
        id: getNextId('depositHistory'), client: name || 'Клиент',
        amount: parseInt(amount),
        date: new Date().toISOString().split('T')[0], status: 'Зачислено'
    });
    saveData();
    renderDepositHistory();
    showToast('Зачисление выполнено!', 'success');
}

function renderWithdrawHistory() {
    const tbody = document.getElementById('withdrawHistoryBody');
    if (!tbody) return;
    if (!appData.withdrawHistory || appData.withdrawHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.withdrawHistory.map(w => `
        <tr>
            <td>${w.id}</td>
            <td>${escapeHtml(w.client)}</td>
            <td>${w.amount} ₽</td>
            <td>${w.date}</td>
            <td><span class="badge badge-success">${w.status}</span></td>
        </tr>
    `).join('');
}

function renderDepositHistory() {
    const tbody = document.getElementById('depositHistoryBody');
    if (!tbody) return;
    if (!appData.depositHistory || appData.depositHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.depositHistory.map(d => `
        <tr>
            <td>${d.id}</td>
            <td>${escapeHtml(d.client)}</td>
            <td>${d.amount} ₽</td>
            <td>${d.date}</td>
            <td><span class="badge badge-success">${d.status}</span></td>
        </tr>
    `).join('');
}

// ================================================================
//  27. БЭК-ЗОНА
// ================================================================
function renderIncoming() {
    const tbody = document.getElementById('incomingBody');
    if (!tbody) return;
    if (!appData.incoming || appData.incoming.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.incoming.map(i => `
        <tr>
            <td><strong>${escapeHtml(i.track)}</strong></td>
            <td>${escapeHtml(i.sender)}</td>
            <td>${i.date}</td>
            <td>${escapeHtml(i.type)}</td>
            <td><span class="badge badge-info">${escapeHtml(i.status)}</span></td>
            <td><button class="btn btn-success btn-xs" onclick="showToast('Обработано', 'success')"><i class="fas fa-check"></i></button></td>
        </tr>
    `).join('');
}

function saveIncoming(e) {
    e.preventDefault();
    const track = document.getElementById('incTrack').value.trim();
    const sender = document.getElementById('incSender').value.trim();
    const type = document.getElementById('incType').value;
    if (!track || !sender) { showToast('Заполните поля!', 'error'); return false; }
    appData.incoming.push({
        id: getNextId('incoming'), track, sender,
        date: new Date().toISOString().split('T')[0],
        type, status: 'Принято'
    });
    saveData();
    closeModal('incomingModal');
    renderIncoming();
    showToast('Зафиксировано!', 'success');
    return false;
}

function renderDocuments() {
    const tbody = document.getElementById('documentsBody');
    if (!tbody) return;
    if (!appData.documents || appData.documents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет документов</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.documents.map(d => `
        <tr>
            <td>${escapeHtml(d.number)}</td>
            <td>${escapeHtml(d.type)}</td>
            <td>${escapeHtml(d.sender)}</td>
            <td>${d.date}</td>
            <td><button class="btn btn-info btn-xs" onclick="openDocument(${d.id})"><i class="fas fa-eye"></i></button></td>
        </tr>
    `).join('');
}

function openDocument(id) {
    const doc = appData.documents.find(d => d.id === id);
    if (!doc) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-window">
            <h3><i class="fas fa-file-alt" style="color:var(--info);"></i> Документ</h3>
            <p><strong>Номер:</strong> ${escapeHtml(doc.number)}</p>
            <p><strong>Тип:</strong> ${escapeHtml(doc.type)}</p>
            <p><strong>Отправитель:</strong> ${escapeHtml(doc.sender)}</p>
            <p><strong>Дата:</strong> ${doc.date}</p>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function searchDocuments() {
    const from = document.getElementById('docSearchFrom').value;
    const to = document.getElementById('docSearchTo').value;
    const number = document.getElementById('docSearchNumber').value.toLowerCase().trim();
    let filtered = appData.documents || [];
    if (from) filtered = filtered.filter(d => d.date >= from);
    if (to) filtered = filtered.filter(d => d.date <= to);
    if (number) filtered = filtered.filter(d => d.number.toLowerCase().includes(number));
    const tbody = document.getElementById('documentsBody');
    if (!tbody) return;
    tbody.innerHTML = filtered.map(d => `
        <tr>
            <td>${escapeHtml(d.number)}</td>
            <td>${escapeHtml(d.type)}</td>
            <td>${escapeHtml(d.sender)}</td>
            <td>${d.date}</td>
            <td><button class="btn btn-info btn-xs" onclick="openDocument(${d.id})"><i class="fas fa-eye"></i></button></td>
        </tr>
    `).join('');
    showToast('Найдено: ' + filtered.length, 'info');
}

// ================================================================
//  28. ЕМКОСТИ
// ================================================================
function renderCapacity() {
    const grid = document.getElementById('capacityGrid');
    if (grid) {
        grid.innerHTML = (appData.capacity || []).map(c => `
            <div class="capacity-item" onclick="showToast('${escapeHtml(c.name)}', 'info')">
                <i class="fas fa-box"></i>
                <h4>${escapeHtml(c.name)}</h4>
                <p>${escapeHtml(c.items || '0 отправлений')} · ${c.weight} кг</p>
                <span class="badge ${c.status === 'Готова' ? 'badge-success' : 'badge-warning'}">${c.status}</span>
            </div>
        `).join('');
    }
    const tbody = document.getElementById('capacityTableBody');
    if (!tbody) return;
    if (!appData.capacity || appData.capacity.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.capacity.map(c => `
        <tr>
            <td><strong>${escapeHtml(c.name)}</strong></td>
            <td>${escapeHtml(c.items || '—')}</td>
            <td>${c.weight} кг</td>
            <td><span class="badge ${c.status === 'Готова' ? 'badge-success' : 'badge-warning'}">${c.status}</span></td>
            <td>
                <button class="btn btn-primary btn-xs" onclick="openModal('capacityEditModal')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-xs" onclick="deleteCapacity(${c.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function saveCapacity(e) {
    e.preventDefault();
    const name = document.getElementById('capName').value.trim();
    const weight = parseFloat(document.getElementById('capWeight').value) || 0;
    const parcels = document.getElementById('capParcels');
    const selected = [];
    for (let opt of parcels.options) if (opt.selected) selected.push(opt.value);
    if (!name) { showToast('Введите название!', 'error'); return false; }
    appData.capacity.push({
        id: getNextId('capacity'), name,
        items: selected.join(', ') || 'Новые отправления',
        weight, status: 'В процессе'
    });
    saveData();
    closeModal('capacityModal');
    renderCapacity();
    showToast('Создано!', 'success');
    return false;
}

function fillCapacityEditSelect() {
    const select = document.getElementById('capEditSelect');
    if (!select) return;
    select.innerHTML = (appData.capacity || []).map(c =>
        `<option value="${c.id}">${escapeHtml(c.name)} (${c.status})</option>`
    ).join('');
}

function editCapacity(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('capEditSelect').value);
    const name = document.getElementById('capEditName').value.trim();
    const status = document.getElementById('capEditStatus').value;
    const cap = appData.capacity.find(c => c.id === id);
    if (!cap) { showToast('Выберите емкость!', 'error'); return false; }
    if (name) cap.name = name;
    cap.status = status;
    saveData();
    closeModal('capacityEditModal');
    renderCapacity();
    showToast('Обновлено!', 'success');
    return false;
}

function deleteCapacity(id) {
    if (!confirm('Удалить?')) return;
    appData.capacity = appData.capacity.filter(c => c.id !== id);
    saveData();
    renderCapacity();
    showToast('Удалено', 'info');
}

// ================================================================
//  29. НАКЛАДНЫЕ
// ================================================================
function renderInvoice() {
    const tbody = document.getElementById('invoiceTableBody');
    if (!tbody) return;
    if (!appData.invoice || appData.invoice.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.invoice.map(i => `
        <tr>
            <td><strong>${escapeHtml(i.number)}</strong></td>
            <td>${escapeHtml(i.type)}</td>
            <td>${escapeHtml(i.creator)}</td>
            <td>${i.date}</td>
            <td><span class="badge ${i.status === 'Готово' ? 'badge-success' : 'badge-warning'}">${i.status}</span></td>
            <td><button class="btn btn-info btn-xs" onclick="viewInvoice(${i.id})"><i class="fas fa-eye"></i></button></td>
        </tr>
    `).join('');
}

function viewInvoice(id) {
    const inv = appData.invoice.find(i => i.id === id);
    if (!inv) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-window">
            <h3><i class="fas fa-file-invoice" style="color:var(--accent);"></i> Накладная</h3>
            <p><strong>Номер:</strong> ${escapeHtml(inv.number)}</p>
            <p><strong>Тип:</strong> ${escapeHtml(inv.type)}</p>
            <p><strong>Создал:</strong> ${escapeHtml(inv.creator)}</p>
            <p><strong>Дата:</strong> ${inv.date}</p>
            <p><strong>Статус:</strong> <span class="badge ${inv.status === 'Готово' ? 'badge-success' : 'badge-warning'}">${inv.status}</span></p>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function saveInvoice(type) {
    const numInput = type === 'Ф23' ? 'invNumber' : 'invNumberA';
    const senderInput = type === 'Ф23' ? 'invSender' : 'invSenderA';
    const receiverInput = type === 'Ф23' ? 'invReceiver' : 'invReceiverA';
    const number = document.getElementById(numInput).value.trim();
    const sender = document.getElementById(senderInput).value.trim();
    const receiver = document.getElementById(receiverInput).value.trim();
    if (!number || !sender || !receiver) { showToast('Заполните поля!', 'error'); return false; }
    appData.invoice.push({
        id: getNextId('invoice'), number, type,
        creator: document.getElementById('displayName')?.textContent || 'Сотрудник',
        date: new Date().toISOString().split('T')[0],
        status: 'В обработке'
    });
    saveData();
    closeModal(type === 'Ф23' ? 'invoiceF23Modal' : 'invoiceF23aModal');
    renderInvoice();
    showToast('Создано!', 'success');
    return false;
}

// ================================================================
//  30. ВОДИТЕЛЬ
// ================================================================
function renderDriver() {
    const tbody = document.getElementById('driverTableBody');
    if (!tbody) return;
    if (!appData.driver || appData.driver.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.driver.map(d => `
        <tr>
            <td><strong>${escapeHtml(d.driver)}</strong></td>
            <td>${escapeHtml(d.transport)}</td>
            <td>${d.capacities}</td>
            <td>${escapeHtml(d.invoices)}</td>
            <td><span class="badge ${d.status === 'Передано' ? 'badge-success' : 'badge-warning'}">${d.status}</span></td>
            <td><button class="btn btn-info btn-xs" onclick="viewDriverDetails(${d.id})"><i class="fas fa-route"></i></button></td>
        </tr>
    `).join('');
}

function viewDriverDetails(id) {
    const driver = appData.driver.find(d => d.id === id);
    if (!driver) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-window">
            <h3><i class="fas fa-route" style="color:var(--accent);"></i> Маршрут</h3>
            <p><strong>Водитель:</strong> ${escapeHtml(driver.driver)}</p>
            <p><strong>Транспорт:</strong> ${escapeHtml(driver.transport)}</p>
            <p><strong>Емкостей:</strong> ${driver.capacities}</p>
            <p><strong>Накладные:</strong> ${escapeHtml(driver.invoices)}</p>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function fillDriverTransferSelects() {
    const capSelect = document.getElementById('dtCapacities');
    const invSelect = document.getElementById('dtInvoices');
    if (capSelect) {
        capSelect.innerHTML = (appData.capacity || []).map(c =>
            `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`
        ).join('');
    }
    if (invSelect) {
        invSelect.innerHTML = (appData.invoice || []).map(i =>
            `<option value="${escapeHtml(i.number)}">${escapeHtml(i.number)}</option>`
        ).join('');
    }
}

function saveDriverTransfer(e) {
    e.preventDefault();
    const driver = document.getElementById('dtDriver').value.trim();
    const transport = document.getElementById('dtTransport').value.trim();
    const capSelect = document.getElementById('dtCapacities');
    const invSelect = document.getElementById('dtInvoices');
    const capacities = [];
    const invoices = [];
    for (let opt of capSelect.options) if (opt.selected) capacities.push(opt.value);
    for (let opt of invSelect.options) if (opt.selected) invoices.push(opt.value);
    if (!driver || !transport) { showToast('Заполните поля!', 'error'); return false; }
    appData.driver.push({
        id: getNextId('driver'), driver, transport,
        capacities: capacities.length || '—',
        invoices: invoices.join(', ') || '—',
        status: 'Передано'
    });
    saveData();
    closeModal('driverTransferModal');
    renderAll();
    showToast('Передано!', 'success');
    return false;
}

// ================================================================
//  31. ПОЧТАЛЬОН
// ================================================================
function renderPostmanTasks() {
    const container = document.getElementById('postmanTasksContainer');
    if (!container) return;
    if (!appData.postmanTasks || appData.postmanTasks.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--gray-500);">Нет заданий</p>';
        return;
    }
    container.innerHTML = appData.postmanTasks.map(t => `
        <div class="delivery-task-card">
            <div class="task-info">
                <i class="fas fa-user-circle"></i>
                <div>
                    <div class="task-name">${escapeHtml(t.name)} — ${escapeHtml(t.route)}</div>
                    <div class="task-desc">${t.count} отправлений · ${escapeHtml(t.addresses || '—')}</div>
                </div>
            </div>
            <div class="task-status">
                <span class="badge ${t.status === 'Выполняется' ? 'badge-success' : 'badge-warning'}">${escapeHtml(t.status)}</span>
                <button class="btn btn-primary btn-xs" onclick="viewTaskDetails(${t.id})"><i class="fas fa-route"></i></button>
            </div>
        </div>
    `).join('');
}

function viewTaskDetails(id) {
    const task = appData.postmanTasks.find(t => t.id === id);
    if (!task) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-window">
            <h3><i class="fas fa-walking" style="color:var(--success);"></i> Задание</h3>
            <p><strong>Почтальон:</strong> ${escapeHtml(task.name)}</p>
            <p><strong>Маршрут:</strong> ${escapeHtml(task.route)}</p>
            <p><strong>Отправлений:</strong> ${task.count}</p>
            <p><strong>Адреса:</strong> ${escapeHtml(task.addresses || '—')}</p>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function savePostmanTask(e) {
    e.preventDefault();
    const name = document.getElementById('ptName').value.trim();
    const route = document.getElementById('ptRoute').value.trim();
    const count = parseInt(document.getElementById('ptCount').value) || 0;
    const addresses = document.getElementById('ptAddresses').value.trim();
    const notes = document.getElementById('ptNotes').value.trim();
    if (!name || !route) { showToast('Заполните поля!', 'error'); return false; }
    appData.postmanTasks.push({
        id: getNextId('postmanTasks'), name, route, count,
        addresses: addresses || 'не указаны',
        notes: notes || '', status: 'Запланировано'
    });
    saveData();
    closeModal('postmanTaskModal');
    renderPostmanTasks();
    showToast('Создано!', 'success');
    return false;
}

// ================================================================
//  32. ЖУРНАЛ РПО
// ================================================================
function renderStorageJournal() {
    const tbody = document.getElementById('storageJournalBody');
    if (!tbody) return;
    if (!appData.storageJournal || appData.storageJournal.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.storageJournal.map(s => {
        const statusInfo = STATUS_LABELS[s.status] || { badge: 'badge-info' };
        return `
            <tr>
                <td><strong>${escapeHtml(s.track)}</strong></td>
                <td>${escapeHtml(s.receiver)}</td>
                <td>${escapeHtml(s.sender)}</td>
                <td>${s.date}</td>
                <td><span class="badge ${statusInfo.badge}">${s.status}</span></td>
            </tr>
        `;
    }).join('');
}

function searchParcel() {
    const track = document.getElementById('searchTrack').value.trim();
    const person = document.getElementById('searchPerson').value.trim();
    const resultDiv = document.getElementById('searchResult');
    let found = (appData.storageJournal || []).find(s =>
        s.track.toLowerCase().includes(track.toLowerCase()) ||
        s.receiver.toLowerCase().includes(person.toLowerCase()) ||
        s.sender.toLowerCase().includes(person.toLowerCase())
    );
    if (!found && track) found = appData.parcels.find(p => p.track === track);
    resultDiv.classList.add('active');
    if (found) {
        resultDiv.innerHTML = `
            <div class="found"><i class="fas fa-check-circle"></i> <strong>Найдено!</strong></div>
            <div style="margin-top:8px;font-size:14px;">
                <p><strong>Трек:</strong> ${escapeHtml(found.track)}</p>
                <p><strong>Получатель:</strong> ${escapeHtml(found.receiver || '—')}</p>
                <p><strong>Отправитель:</strong> ${escapeHtml(found.sender || '—')}</p>
                <p><strong>Статус:</strong> <span class="badge badge-info">${found.status || '—'}</span></p>
            </div>
        `;
        showToast('Найдено!', 'success');
    } else {
        resultDiv.innerHTML = `<div class="not-found"><i class="fas fa-exclamation-circle"></i> <strong>Не найдено</strong></div>`;
        showToast('Не найдено', 'error');
    }
}

// ================================================================
//  33. АДРЕСНОЕ ХРАНЕНИЕ
// ================================================================
function renderAddressStorage() {
    const tbody = document.getElementById('addressStorageBody');
    if (!tbody) return;
    if (!appData.addressStorage || appData.addressStorage.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
    } else {
        tbody.innerHTML = appData.addressStorage.map(a => `
            <tr>
                <td><strong>${escapeHtml(a.cell)}</strong></td>
                <td>${escapeHtml(a.track)}</td>
                <td>${escapeHtml(a.receiver)}</td>
                <td>${a.term}</td>
                <td><span class="badge badge-info">${a.status}</span></td>
            </tr>
        `).join('');
    }
    const zones = { 'A': 0, 'B': 0, 'C': 0, 'D': 0 };
    (appData.addressStorage || []).forEach(a => {
        const letter = a.cell.charAt(0).toUpperCase();
        if (zones[letter] !== undefined) zones[letter]++;
    });
    ['A', 'B', 'C', 'D'].forEach((letter, i) => {
        const el = document.getElementById('zone' + String.fromCharCode(65 + i));
        if (el) el.textContent = zones[letter];
    });
}

// ================================================================
//  34. ВОЗВРАТ/ДОСЫЛ
// ================================================================
function renderReturnForward() {
    const tbody = document.getElementById('returnForwardBody');
    if (!tbody) return;
    if (!appData.returnForward || appData.returnForward.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.returnForward.map(r => `
        <tr>
            <td><strong>${escapeHtml(r.track)}</strong></td>
            <td>${escapeHtml(r.sender)}</td>
            <td>${escapeHtml(r.receiver || '—')}</td>
            <td><span class="badge ${r.operation === 'Возврат' ? 'badge-warning' : 'badge-info'}">${escapeHtml(r.operation)}</span></td>
            <td><button class="btn btn-success btn-xs" onclick="showToast('Оформлено', 'success')"><i class="fas fa-check"></i></button></td>
        </tr>
    `).join('');
}

function saveReturn(e) {
    e.preventDefault();
    const track = document.getElementById('retTrack').value.trim();
    const reason = document.getElementById('retReason').value.trim();
    const newAddress = document.getElementById('retNewAddress').value.trim();
    if (!track) { showToast('Введите трек!', 'error'); return false; }
    appData.returnForward.push({
        id: getNextId('returnForward'), track,
        sender: 'Неизвестно', receiver: newAddress || '—',
        operation: 'Возврат' + (reason ? ' (' + reason + ')' : '')
    });
    saveData();
    closeModal('returnModal');
    renderReturnForward();
    showToast('На возврат', 'success');
    return false;
}

function saveForward(e) {
    e.preventDefault();
    const track = document.getElementById('fwdTrack').value.trim();
    const receiver = document.getElementById('fwdReceiver').value.trim();
    const address = document.getElementById('fwdAddress').value.trim();
    const reason = document.getElementById('fwdReason').value.trim();
    if (!track || !receiver || !address) { showToast('Заполните поля!', 'error'); return false; }
    appData.returnForward.push({
        id: getNextId('returnForward'), track,
        sender: 'Неизвестно',
        receiver: receiver + ' (' + address + ')',
        operation: 'Досыл' + (reason ? ' (' + reason + ')' : '')
    });
    saveData();
    closeModal('forwardModal');
    renderReturnForward();
    showToast('На досыл', 'success');
    return false;
}

// ================================================================
//  35. ОТЧЁТЫ
// ================================================================
function updateReportStats() {
    const cash1 = (appData.cashReport || []).reduce((s, c) => s + c.income, 0);
    const cash2 = (appData.cashReport || []).reduce((s, c) => s + c.outcome, 0);
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('cash1', cash1.toLocaleString('ru-RU') + ' ₽');
    set('cash2', cash2.toLocaleString('ru-RU') + ' ₽');
    set('cashTotal', (cash1 + cash2).toLocaleString('ru-RU') + ' ₽');
    set('cashOperations', (appData.cashReport || []).length);
    set('mc42Start', cash2.toLocaleString('ru-RU') + ' ₽');
    set('mc42Income', cash1.toLocaleString('ru-RU') + ' ₽');
    set('mc42End', (cash1 + cash2).toLocaleString('ru-RU') + ' ₽');
    const mc42Date = document.getElementById('mc42Date');
    set('mc42DateDisplay', mc42Date?.value || new Date().toISOString().split('T')[0]);

    const letters = (appData.report2ap || []).filter(r => r.type === 'Письма');
    const newspapers = (appData.report2ap || []).filter(r => r.type === 'Газеты');
    const parcels = (appData.report2ap || []).filter(r => r.type === 'Посылки');
    set('report2apInLetters', letters.reduce((s, r) => s + r.incoming, 0));
    set('report2apOutLetters', letters.reduce((s, r) => s + r.outgoing, 0));
    set('report2apInNewspapers', newspapers.reduce((s, r) => s + r.incoming, 0));
    set('report2apOutNewspapers', newspapers.reduce((s, r) => s + r.outgoing, 0));
    set('report2apInParcels', parcels.reduce((s, r) => s + r.incoming, 0));
    set('report2apOutParcels', parcels.reduce((s, r) => s + r.outgoing, 0));

    renderGoodsReport();
    const goodsTotal = (appData.goodsReport || []).reduce((s, g) => s + g.income, 0);
    const goodsOut = (appData.goodsReport || []).reduce((s, g) => s + g.outcome, 0);
    const goodsBal = (appData.goodsReport || []).reduce((s, g) => s + g.balance, 0);
    set('goodsStartBalance', goodsTotal + ' шт.');
    set('goodsIncome', goodsTotal + ' шт.');
    set('goodsOutcome', goodsOut + ' шт.');
    set('goodsEndBalance', goodsBal + ' шт.');
}

function generateReport2ap() {
    const from = document.getElementById('report2apFrom').value;
    const to = document.getElementById('report2apTo').value;
    if (!from || !to) { showToast('Выберите период!', 'warning'); return; }
    appData.report2ap = [];
    const types = ['Письма', 'Газеты', 'Посылки', 'Бандероли', 'EMS'];
    let currentDate = new Date(from);
    const endDate = new Date(to);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        types.forEach(type => {
            appData.report2ap.push({
                date: dateStr,
                incoming: Math.floor(Math.random() * 40) + 5,
                outgoing: Math.floor(Math.random() * 35) + 5,
                type
            });
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    saveData();
    updateReportStats();
    renderReport2ap();
    showToast(`Отчёт: ${appData.report2ap.length} записей`, 'success');
}

function renderReport2ap() {
    const tbody = document.getElementById('report2apTableBody');
    if (!tbody) return;
    if (!appData.report2ap || appData.report2ap.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.report2ap.map(r => `
        <tr>
            <td>${r.date}</td>
            <td>${r.incoming}</td>
            <td>${r.outgoing}</td>
            <td>${r.type}</td>
        </tr>
    `).join('');
}

function renderGoodsReport() {
    const tbody = document.getElementById('goodsReportTableBody');
    if (!tbody) return;
    if (!appData.goodsReport || appData.goodsReport.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.goodsReport.map(g => `
        <tr>
            <td>${g.id}</td>
            <td><strong>${escapeHtml(g.name)}</strong></td>
            <td>${g.income}</td>
            <td>${g.outcome}</td>
            <td><strong>${g.balance}</strong></td>
        </tr>
    `).join('');
}

function generateGoodsReport() {
    generateGoodsReportData();
    updateReportStats();
    renderGoodsReport();
    showToast('Отчёт ТМЦ сформирован', 'success');
}

function generateGoodsReportData() {
    appData.goodsReport = [];
    (appData.products || []).forEach(p => {
        const stock = appData.goodsStock.find(s => s.name === p.name);
        const receipts = (appData.goodsReceipt || []).filter(r => r.name === p.name);
        const totalIncome = receipts.reduce((sum, r) => sum + r.qty, 0);
        const writeoffs = (appData.goodsWriteoff || []).filter(w => w.name === p.name);
        const totalOutcome = writeoffs.reduce((sum, w) => sum + w.qty, 0);
        const balance = stock ? stock.qty : p.qty;
        appData.goodsReport.push({
            id: getNextId('goodsReport'), name: p.name,
            income: totalIncome + (stock ? stock.qty : 0),
            outcome: totalOutcome, balance
        });
    });
}

function renderCashReport() {
    const tbody = document.getElementById('cashReportBody');
    if (!tbody) return;
    if (!appData.cashReport || appData.cashReport.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.cashReport.map(c => `
        <tr>
            <td>${c.id}</td>
            <td>${escapeHtml(c.operator)}</td>
            <td>${c.income} ₽</td>
            <td>${c.outcome} ₽</td>
            <td>${c.date}</td>
            <td><span class="badge ${c.status === 'Закрыта' ? 'badge-success' : 'badge-warning'}">${c.status}</span></td>
        </tr>
    `).join('');
}

function renderServiceCash() {
    const tbody = document.getElementById('serviceCashBody');
    if (!tbody) return;
    if (!appData.serviceCash || appData.serviceCash.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.serviceCash.map(c => `
        <tr>
            <td>${c.id}</td>
            <td>${escapeHtml(c.operator)}</td>
            <td>${c.income} ₽</td>
            <td>${c.outcome} ₽</td>
            <td>${c.date}</td>
            <td><span class="badge ${c.status === 'Закрыта' ? 'badge-success' : 'badge-warning'}">${c.status}</span></td>
        </tr>
    `).join('');
}

// ================================================================
//  36. ОБРАТНАЯ СВЯЗЬ
// ================================================================
function submitFeedback(e) {
    e.preventDefault();
    const form = document.getElementById('feedbackForm');
    const formData = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
    btn.disabled = true;
    fetch('https://formspree.io/f/xjyvvgbp', {
        method: 'POST', body: formData, headers: { 'Accept': 'application/json' }
    })
    .then(response => {
        if (response.ok) {
            document.getElementById('feedbackForm').style.display = 'none';
            document.getElementById('feedbackSuccess').classList.add('active');
            showToast('Отправлено!', 'success');
        } else {
            showToast('Ошибка', 'error');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    })
    .catch(() => {
        showToast('Ошибка соединения', 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
    return false;
}

// ================================================================
//  37. ЭКСПОРТ (с периодом)
// ================================================================
function getExportPeriod(buttonEl) {
    let from = null, to = null;
    if (buttonEl) {
        const toolbar = buttonEl.closest('.toolbar');
        if (toolbar) {
            const pb = toolbar.querySelector('.export-period');
            if (pb) {
                from = pb.querySelector('.export-date-from')?.value || null;
                to = pb.querySelector('.export-date-to')?.value || null;
            }
        }
    }
    return { from, to };
}

function normalizeDate(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    // ISO: 2026-06-17 или 2026-06-17T10:00:00
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // dd.mm.yyyy или dd/mm/yyyy
    const m = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
    if (m) {
        const dd = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        return `${m[3]}-${mm}-${dd}`;
    }
    // Пробуем Date
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
}

function filterTableByPeriod(tableEl, from, to) {
    if (!tableEl) return { headers: [], rows: [] };

    const headers = [];
    tableEl.querySelectorAll('thead th').forEach(th => headers.push(th.innerText.trim()));

    const lowerHeaders = headers.map(h => h.toLowerCase());
    const dateIdx = lowerHeaders.findIndex(h => h.includes('дата') || h.includes('date'));

    const rows = tableEl.querySelectorAll('tbody tr');
    const result = [];

    rows.forEach(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells.length === 0) return;

        let cellDate = null;

        // 1) дата из ячейки (если есть столбец с датой)
        if (dateIdx >= 0 && cells[dateIdx]) {
            cellDate = normalizeDate(cells[dateIdx].innerText.trim());
        }
        // 2) fallback — атрибут data-date у <tr>
        if (!cellDate && tr.dataset && tr.dataset.date) {
            cellDate = normalizeDate(tr.dataset.date);
        }
        // 3) fallback — поиск даты в любой ячейке
        if (!cellDate) {
            for (let i = 0; i < cells.length; i++) {
                const d = normalizeDate(cells[i].innerText.trim());
                if (d) { cellDate = d; break; }
            }
        }

        // Если период задан, но дату найти не удалось — пропускаем строку
        if ((from || to) && !cellDate) return;

        if (cellDate) {
            if (from && cellDate < from) return;
            if (to && cellDate > to) return;
        }

        const rowData = [];
        cells.forEach(td => rowData.push(td.innerText.trim().replace(/\s+/g, ' ')));
        result.push(rowData);
    });

    return { headers, rows: result };
}

function exportToPDF(elementId, filename = 'документ', buttonEl = null) {
    const el = document.getElementById(elementId);
    if (!el) { showToast('Элемент не найден!', 'error'); return; }

    // Ищем таблицу: сам элемент, его родитель или вложенную
    let table = null;
    if (el.tagName === 'TABLE') table = el;
    else table = el.closest('table') || el.querySelector('table');

    let headers = [];
    let dataRows = [];
    let periodFrom = null, periodTo = null;

    if (table) {
        const period = getExportPeriod(buttonEl, elementId);
        periodFrom = period.from;
        periodTo = period.to;

        const filtered = filterTableByPeriod(table, period.from, period.to);
        if (filtered.rows.length === 0) {
            showToast('Нет данных за выбранный период', 'warning');
            return;
        }
        headers = filtered.headers;
        dataRows = filtered.rows;
    } else {
        headers = ['Содержимое'];
        dataRows = [[el.innerText.trim()]];
    }

    let tableHTML = '<table class="print-table">';
    tableHTML += '<thead><tr>';
    headers.forEach(h => { tableHTML += `<th>${escapeHtml(h)}</th>`; });
    tableHTML += '</tr></thead><tbody>';
    dataRows.forEach(row => {
        tableHTML += '<tr>';
        row.forEach(cell => { tableHTML += `<td>${escapeHtml(cell)}</td>`; });
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';

    let periodText = '';
    if (periodFrom || periodTo) {
        periodText = `<p><strong>Период:</strong> ${periodFrom || '...'} — ${periodTo || '...'}</p>`;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) { showToast('Разрешите всплывающие окна', 'error'); return; }

    printWindow.document.write(`
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${escapeHtml(filename)}</title>
<style>
    * { box-sizing: border-box; }
    body { font-family: 'Inter', Arial, sans-serif; padding: 30px; background: #fff; color: #1e293b; margin: 0; }
    .print-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #0d2b4a; flex-wrap: wrap; gap: 10px; }
    .print-header h1 { color: #0d2b4a; font-size: 20px; margin: 0; font-weight: 700; }
    .print-header .meta { font-size: 12px; color: #64748b; text-align: right; }
    .print-header .meta p { margin: 2px 0; }
    table.print-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
    table.print-table th { background: #0d2b4a; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 10px; text-transform: uppercase; border: 1px solid #0d2b4a; }
    table.print-table td { padding: 7px 10px; border: 1px solid #cbd5e1; color: #1e293b; vertical-align: top; }
    table.print-table tbody tr:nth-child(even) td { background: #f8fafc; }
    .print-footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 12mm; } .print-header h1 { font-size: 16px; } table.print-table { font-size: 9px; } table.print-table th, table.print-table td { padding: 4px 6px; } }
</style></head><body>
<div class="print-header">
    <h1>📄 ${escapeHtml(filename)}</h1>
    <div class="meta">
        <p><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        ${periodText}
    </div>
</div>
${tableHTML}
<div class="print-footer">Документ сгенерирован автоматически · Почта России · Всего записей: ${dataRows.length}</div>
</body></html>`);
    printWindow.document.close();

    printWindow.onload = () => {
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 300);
    };
    showToast(`PDF "${filename}" (${dataRows.length} записей)`, 'success');
}

function exportToExcelTable(tableId, filename = 'документ', buttonEl = null) {
    const table = document.getElementById(tableId);
    if (!table) { showToast('Таблица не найдена', 'error'); return; }

    // Если передали tbody — поднимаемся к таблице
    const realTable = table.tagName === 'TABLE' ? table : table.closest('table') || table;

    const period = getExportPeriod(buttonEl, tableId);
    const filtered = filterTableByPeriod(realTable, period.from, period.to);

    if (!filtered.rows || filtered.rows.length === 0) {
        showToast('Нет данных за выбранный период', 'warning');
        return;
    }

    const data = [filtered.headers, ...filtered.rows];
    const periodSuffix = (period.from || period.to) ? `_${period.from || ''}_${period.to || ''}` : '';

    if (typeof XLSX === 'undefined') {
        const csv = data.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}${periodSuffix}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast(`CSV "${filename}" (${filtered.rows.length} строк)`, 'success');
        return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    const colWidths = [];
    data.forEach(row => row.forEach((cell, i) => {
        const len = String(cell).length;
        if (!colWidths[i] || len > colWidths[i]) colWidths[i] = Math.min(len * 1.2 + 2, 50);
    }));
    ws['!cols'] = colWidths.map(w => ({ wch: Math.max(w || 12, 12) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Лист1');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}${periodSuffix}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`Excel "${filename}" (${filtered.rows.length} строк)`, 'success');
}

function exportToWord(elementId, filename = 'документ', buttonEl = null) {
    const el = document.getElementById(elementId);
    if (!el) { showToast('Элемент не найден', 'error'); return; }

    let table = null;
    if (el.tagName === 'TABLE') table = el;
    else table = el.closest('table') || el.querySelector('table');

    if (!table) { showToast('Таблица не найдена', 'error'); return; }

    const period = getExportPeriod(buttonEl, elementId);
    const filtered = filterTableByPeriod(table, period.from, period.to);
    if (!filtered.rows || filtered.rows.length === 0) {
        showToast('Нет данных', 'warning');
        return;
    }

    let tableHTML = '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;">';
    tableHTML += '<thead><tr>';
    filtered.headers.forEach(h => { tableHTML += `<th style="background:#0d2b4a;color:white;padding:6px 10px;border:1px solid #333;">${escapeHtml(h)}</th>`; });
    tableHTML += '</tr></thead><tbody>';
    filtered.rows.forEach(row => {
        tableHTML += '<tr>';
        row.forEach(cell => { tableHTML += `<td style="padding:6px 10px;border:1px solid #333;">${escapeHtml(cell)}</td>`; });
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';

    let periodText = '';
    if (period.from || period.to) periodText = `<p><strong>Период:</strong> ${period.from || '...'} — ${period.to || '...'}</p>`;

    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8"><style>body{font-family:Arial;padding:20px;}table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #333;padding:6px 10px;font-size:12px;}th{background:#0d2b4a;color:white;}h1{color:#0d2b4a;font-size:20px;}</style></head>
<body><h1>📄 ${escapeHtml(filename)}</h1><p><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</p>${periodText}${tableHTML}<p style="margin-top:30px;font-size:11px;color:#666;">Всего записей: ${filtered.rows.length}</p></body></html>`;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/msword;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const periodSuffix = (period.from || period.to) ? `_${period.from || ''}_${period.to || ''}` : '';
    link.download = `${filename}${periodSuffix}.doc`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`Word "${filename}" (${filtered.rows.length} строк)`, 'success');
}

function printTable(tableId, filename, btn) { exportToPDF(tableId, filename, btn); }
function exportTableToExcel(tableId, filename, btn) { exportToExcelTable(tableId, filename, btn); }
function printMC42(btn) { exportToPDF('mc42Result', 'Справка_МС-42', btn); }
function printReport2ap(btn) { exportToPDF('report2apTableBody', 'Отчёт_ф2а-п', btn); }
function printGoodsReport(btn) { exportToPDF('goodsReportTableBody', 'Отчёт_ТМЦ', btn); }
function exportExcelCash(btn) { exportToExcelTable('cashReportBody', 'Кассовый_отчёт', btn); }
function exportWordCash(btn) { exportToWord('cashReportBody', 'Кассовый_отчёт', btn); }
function printCashReport(btn) { exportToPDF('cashReportBody', 'Кассовый_отчёт', btn); }
function printHistory(btn) { exportToPDF('historyModalBody', 'История_платежей', btn); }
function printDocument(btn) { exportToPDF('documentsBody', 'Документы', btn); }
function printJournal(btn) { exportToPDF('journalBody', 'Журнал_операций', btn); }
function exportRPOExcel(btn) { exportToExcelTable('rpoMovementTable', 'Отчёт_РПО', btn); }
function printRPOReport(btn) { exportToPDF('rpoMovementTable', 'Отчёт_по_движению_РПО', btn); }

function generateMC42() {
    const date = document.getElementById('mc42Date').value || new Date().toISOString().split('T')[0];
    document.getElementById('mc42DateDisplay').textContent = date;
    updateReportStats();
    showToast('Справка МС-42 сформирована', 'success');
}

// ================================================================
//  38. ОТЧЁТ РПО (движение)
// ================================================================
function getRPOData() {
    return {
        rows: [
            { name: 'Заказные почтовые отправления и уведомления с вручении, кроме разряда "Судебные"', start_ops: 22, start_delivery: 20, start_total: 42, received: 15, delivered: 12, lost: 0, forwarded: 1, end_ops: 25, end_delivery: 18, end_total: 43 },
            { name: 'Заказные почтовые отправления разряда "Судебные"', start_ops: 5, start_delivery: 3, start_total: 8, received: 4, delivered: 2, lost: 0, forwarded: 0, end_ops: 7, end_delivery: 3, end_total: 10 },
            { name: 'Мелкие пакеты', start_ops: 10, start_delivery: 8, start_total: 18, received: 6, delivered: 5, lost: 1, forwarded: 0, end_ops: 11, end_delivery: 7, end_total: 18 },
            { name: 'Простые мелкие пакеты', start_ops: 15, start_delivery: 10, start_total: 25, received: 8, delivered: 7, lost: 0, forwarded: 2, end_ops: 16, end_delivery: 8, end_total: 24 },
            { name: 'Мешок М', start_ops: 3, start_delivery: 2, start_total: 5, received: 2, delivered: 1, lost: 0, forwarded: 0, end_ops: 4, end_delivery: 2, end_total: 6 },
            { name: 'Письменная корреспонденция с объявленной ценностью', start_ops: 8, start_delivery: 5, start_total: 13, received: 4, delivered: 3, lost: 0, forwarded: 1, end_ops: 9, end_delivery: 4, end_total: 13 }
        ]
    };
}

function renderRPOMovement() {
    const data = getRPOData();
    const tbody = document.getElementById('rpoMovementBody');
    if (!tbody) return;
    const totals = { start_ops: 0, start_delivery: 0, start_total: 0, received: 0, delivered: 0, lost: 0, forwarded: 0, end_ops: 0, end_delivery: 0, end_total: 0 };
    let html = '';
    data.rows.forEach(row => {
        Object.keys(totals).forEach(k => totals[k] += row[k]);
        html += `
            <tr>
                <td style="text-align:left;font-size:11px;padding:4px 6px;">${escapeHtml(row.name)}</td>
                <td style="padding:4px 6px;">${row.start_ops}</td>
                <td style="padding:4px 6px;">${row.start_delivery}</td>
                <td style="padding:4px 6px;font-weight:700;">${row.start_total}</td>
                <td style="padding:4px 6px;">${row.received}</td>
                <td style="padding:4px 6px;">${row.delivered}</td>
                <td style="padding:4px 6px;">${row.lost}</td>
                <td style="padding:4px 6px;">${row.forwarded}</td>
                <td style="padding:4px 6px;">${row.end_ops}</td>
                <td style="padding:4px 6px;">${row.end_delivery}</td>
                <td style="padding:4px 6px;font-weight:700;">${row.end_total}</td>
            </tr>
        `;
    });
    html += `
        <tr class="total-row">
            <td style="text-align:left;font-size:11px;padding:4px 6px;"><strong>ИТОГО</strong></td>
            ${Object.keys(totals).map(k => `<td style="padding:4px 6px;font-weight:700;">${totals[k]}</td>`).join('')}
        </tr>
    `;
    tbody.innerHTML = html;
}

function refreshRPOTable() {
    const now = new Date();
    const dateStr = now.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    const el = document.getElementById('rpoReportDate');
    if (el) el.textContent = dateStr + ' г.';
    renderRPOMovement();
    showToast('Обновлено', 'success');
}

// ================================================================
//  39. ЖУРНАЛ
// ================================================================
function getJournalData() {
    return [
        { date: '2026-08-24', time: '16:24:13', window: 'Окно 01', user: 'Будушева Надежда Ивановна', check: '255', fd: '21029', amount: 548.00, status: 'Завершена' },
        { date: '2026-08-24', time: '16:24:13', window: 'Окно 01', user: 'Будушева Надежда Ивановна', check: '254', fd: '21078', amount: 192.00, status: 'Завершена' },
        { date: '2026-08-24', time: '15:10:45', window: 'Окно 02', user: 'Петров Сергей Викторович', check: '251', fd: '21074', amount: 1200.00, status: 'Завершена' },
        { date: '2026-08-24', time: '14:55:22', window: 'Окно 01', user: 'Будушева Надежда Ивановна', check: '250', fd: '21073', amount: 89.50, status: 'Завершена' },
        { date: '2026-08-24', time: '14:30:10', window: 'Окно 03', user: 'Сидорова Елена Михайловна', check: '249', fd: '21072', amount: 2340.00, status: 'В процессе' },
        { date: '2026-08-23', time: '17:20:33', window: 'Окно 01', user: 'Будушева Надежда Ивановна', check: '248', fd: '21071', amount: 780.00, status: 'Завершена' },
    ];
}

function renderJournal() {
    const data = getJournalData();
    appData.journal = data;
    const tbody = document.getElementById('journalBody');
    if (!tbody) return;
    tbody.innerHTML = data.map(row => `
        <tr>
            <td>${row.date}</td>
            <td>${row.time}</td>
            <td>${escapeHtml(row.window)}</td>
            <td>${escapeHtml(row.user)}</td>
            <td>${row.check}</td>
            <td>${row.fd}</td>
            <td><strong>${row.amount.toFixed(2).replace('.', ',')}</strong></td>
            <td><span class="${row.status === 'Завершена' ? 'journal-status-completed' : 'journal-status-pending'}">${row.status}</span></td>
        </tr>
    `).join('');
}

function filterJournal() {
    const search = document.getElementById('journalSearch').value.toLowerCase().trim();
    const dateFrom = document.getElementById('journalDateFrom').value;
    const dateTo = document.getElementById('journalDateTo').value;
    const fd = document.getElementById('journalFd').value.trim();
    const check = document.getElementById('journalCheck').value.trim();
    const windowFilter = document.getElementById('journalWindow').value;
    let data = getJournalData();
    if (search) data = data.filter(r => r.user.toLowerCase().includes(search) || r.check.includes(search) || r.fd.includes(search));
    if (dateFrom) data = data.filter(r => r.date >= dateFrom);
    if (dateTo) data = data.filter(r => r.date <= dateTo);
    if (fd) data = data.filter(r => r.fd.includes(fd));
    if (check) data = data.filter(r => r.check.includes(check));
    if (windowFilter) data = data.filter(r => r.window === windowFilter);
    const tbody = document.getElementById('journalBody');
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--gray-500);">Не найдено</td></tr>`;
        return;
    }
    tbody.innerHTML = data.map(row => `
        <tr>
            <td>${row.date}</td>
            <td>${row.time}</td>
            <td>${escapeHtml(row.window)}</td>
            <td>${escapeHtml(row.user)}</td>
            <td>${row.check}</td>
            <td>${row.fd}</td>
            <td><strong>${row.amount.toFixed(2).replace('.', ',')}</strong></td>
            <td><span class="${row.status === 'Завершена' ? 'journal-status-completed' : 'journal-status-pending'}">${row.status}</span></td>
        </tr>
    `).join('');
    showToast(`Найдено ${data.length}`, 'info');
}

function resetJournalFilters() {
    ['journalSearch','journalDateFrom','journalDateTo','journalFd','journalCheck','journalWindow'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    renderJournal();
}

function exportJournalExcel() {
    const data = appData.journal || getJournalData();
    if (data.length === 0) { showToast('Нет данных', 'warning'); return; }
    if (typeof XLSX === 'undefined') { showToast('XLSX не загружен', 'error'); return; }
    const headers = ['Дата', 'Время', 'Номер окна', 'Пользователь', 'Номер чека', 'Номер ФД', 'Сумма (₽)', 'Статус'];
    const rows = [headers];
    data.forEach(r => rows.push([r.date, r.time, r.window, r.user, r.check, r.fd, r.amount.toFixed(2), r.status]));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const colWidths = [];
    rows.forEach(row => row.forEach((c, i) => {
        const len = String(c).length;
        if (!colWidths[i] || len > colWidths[i]) colWidths[i] = Math.min(len * 1.2 + 2, 40);
    }));
    ws['!cols'] = colWidths.map(w => ({ wch: Math.max(w || 12, 12) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Журнал');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Журнал_операций_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Журнал выгружен', 'success');
}

// ================================================================
//  40. ИСТОРИЯ ПЛАТЕЖЕЙ
// ================================================================
function fillHistoryModal() { renderHistoryData(); }

function renderHistoryData(filteredData) {
    const tbody = document.getElementById('historyModalBody');
    if (!tbody) return;
    let data = filteredData || [...(appData.cityPayments || []), ...(appData.utilityPayments || [])];
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет платежей</td></tr>`;
        const el = document.getElementById('historyTotalAmount');
        if (el) el.textContent = '0 ₽';
        return;
    }
    data.sort((a, b) => (a.date < b.date ? 1 : -1));
    let total = 0;
    tbody.innerHTML = data.map(p => {
        total += p.amount || 0;
        let details = '';
        if (p.account) details += 'Счёт: ' + p.account;
        if (p.contract) details += (details ? ' | ' : '') + 'Договор: ' + p.contract;
        if (p.bank) details += (details ? ' | ' : '') + 'Банк: ' + p.bank;
        return `
            <tr>
                <td>${p.id}</td>
                <td>${escapeHtml(p.payer || '—')}</td>
                <td>${escapeHtml(p.service || '—')}${details ? '<br><span style="font-size:10px;color:var(--gray-400);">' + escapeHtml(details) + '</span>' : ''}</td>
                <td>${(p.amount || 0).toLocaleString('ru-RU')} ₽</td>
                <td>${p.date || '—'}</td>
                <td><span class="badge ${p.status === 'Оплачено' ? 'badge-success' : 'badge-warning'}">${p.status || '—'}</span></td>
            </tr>
        `;
    }).join('');
    const totalEl = document.getElementById('historyTotalAmount');
    if (totalEl) totalEl.textContent = total.toLocaleString('ru-RU') + ' ₽';
}

function filterHistory() {
    const dateFrom = document.getElementById('historyDateFrom').value;
    const dateTo = document.getElementById('historyDateTo').value;
    const search = document.getElementById('historySearch').value.toLowerCase().trim();
    let data = [...(appData.cityPayments || []), ...(appData.utilityPayments || [])];
    if (dateFrom) data = data.filter(p => p.date >= dateFrom);
    if (dateTo) data = data.filter(p => p.date <= dateTo);
    if (search) data = data.filter(p =>
        (p.payer || '').toLowerCase().includes(search) ||
        (p.service || '').toLowerCase().includes(search)
    );
    renderHistoryData(data);
    showToast('Найдено ' + data.length, 'info');
}

function resetHistoryFilter() {
    ['historyDateFrom','historyDateTo','historySearch'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    renderHistoryData();
}

function exportHistoryExcel() {
    const allData = [...(appData.cityPayments || []), ...(appData.utilityPayments || [])];
    if (allData.length === 0) { showToast('Нет данных', 'warning'); return; }
    if (typeof XLSX === 'undefined') { showToast('XLSX не загружен', 'error'); return; }
    const rows = [['№', 'Плательщик', 'Услуга', 'Сумма (₽)', 'Дата', 'Статус', 'Детали']];
    allData.forEach(p => {
        let details = '';
        if (p.account) details += 'Счёт: ' + p.account;
        if (p.contract) details += (details ? ' | ' : '') + 'Договор: ' + p.contract;
        if (p.bank) details += (details ? ' | ' : '') + 'Банк: ' + p.bank;
        rows.push([p.id || '—', p.payer || '—', p.service || '—', p.amount || 0, p.date || '—', p.status || '—', details]);
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const colWidths = [];
    rows.forEach(row => row.forEach((c, i) => {
        const len = String(c).length;
        if (!colWidths[i] || len > colWidths[i]) colWidths[i] = Math.min(len * 1.2 + 2, 50);
    }));
    ws['!cols'] = colWidths.map(w => ({ wch: Math.max(w || 12, 12) }));
    XLSX.utils.book_append_sheet(wb, ws, 'История');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `История_платежей_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('История выгружена', 'success');
}

// ================================================================
//  41. СИСТЕМА ГОРОД (услуги/кредиты)
// ================================================================
function submitServicePayment(e) {
    e.preventDefault();
    const service = document.getElementById('serviceType').value;
    const payer = document.getElementById('servicePayer').value.trim();
    const account = document.getElementById('serviceAccount').value.trim();
    const amount = parseFloat(document.getElementById('serviceAmount').value);
    const date = document.getElementById('serviceDate').value || new Date().toISOString().split('T')[0];
    const purpose = document.getElementById('servicePurpose').value.trim();
    if (!service) { showToast('Выберите услугу!', 'error'); return false; }
    if (!payer) { showToast('Введите ФИО!', 'error'); return false; }
    const accCheck = validateAccount(account);
    if (!accCheck.valid) { showToast('❌ ' + accCheck.error, 'error'); return false; }
    if (!amount || amount <= 0) { showToast('Введите сумму!', 'error'); return false; }
    cityCart.push({
        id: Date.now(), type: 'service', service, payer, account, amount, date,
        purpose: purpose || 'Оплата услуги', status: 'В корзине'
    });
    updateCityCartBadge();
    showToast('Услуга в корзине!', 'success');
    const rd = document.getElementById('servicePaymentResult');
    rd.style.display = 'block';
    rd.className = 'result-box success';
    rd.innerHTML = `<i class="fas fa-check-circle"></i> <strong>В корзину!</strong><div>${escapeHtml(service)} — ${amount.toLocaleString('ru-RU')} ₽</div>`;
    document.getElementById('servicePaymentForm').style.display = 'none';
    return false;
}

function submitCreditPayment(e) {
    e.preventDefault();
    const bank = document.getElementById('creditBank').value;
    const payer = document.getElementById('creditPayer').value.trim();
    const contract = document.getElementById('creditContract').value.trim();
    const amount = parseFloat(document.getElementById('creditAmount').value);
    const date = document.getElementById('creditDate').value || new Date().toISOString().split('T')[0];
    const type = document.getElementById('creditType').value;
    if (!bank) { showToast('Выберите банк!', 'error'); return false; }
    if (!payer) { showToast('Введите ФИО!', 'error'); return false; }
    if (!contract) { showToast('Введите договор!', 'error'); return false; }
    if (!amount || amount <= 0) { showToast('Введите сумму!', 'error'); return false; }
    cityCart.push({
        id: Date.now(), type: 'credit', bank, payer, contract, amount, date,
        paymentType: type, status: 'В корзине'
    });
    updateCityCartBadge();
    showToast('Кредит в корзине!', 'success');
    const rd = document.getElementById('creditPaymentResult');
    rd.style.display = 'block';
    rd.className = 'result-box success';
    rd.innerHTML = `<i class="fas fa-check-circle"></i> <strong>В корзину!</strong><div>${escapeHtml(bank)} — ${amount.toLocaleString('ru-RU')} ₽</div>`;
    document.getElementById('creditPaymentForm').style.display = 'none';
    return false;
}

// ================================================================
//  42. FIRESTORE
// ================================================================
async function saveDataToFirestore() {
    if (!currentUser) return false;
    try {
        const dataToSave = {};
        const keys = ['parcels','rpo','services','products','goodsStock','goodsReceipt','goodsWriteoff',
            'goodsMove','goodsReturn','goodsUtil','delivery','deliveryReturn','lottery','insurance','sim',
            'digital','telegram','copy','pension','cityPayments','utilityPayments','withdrawHistory',
            'depositHistory','incoming','documents','capacity','invoice','driver','postmanTasks',
            'storageJournal','addressStorage','returnForward','cashReport','report2ap','rpoReport',
            'goodsReport','serviceCash','incidents','currentId','shiftState'];
        keys.forEach(k => dataToSave[k] = appData[k] || []);
        dataToSave.lastUpdated = new Date().toISOString();
        await db.collection('users').doc(currentUser.uid).set({
            data: dataToSave,
            email: currentUser.email,
            displayName: currentUser.displayName || 'Сотрудник',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return true;
    } catch (error) {
        console.error('Firestore save error:', error);
        return false;
    }
}

async function loadDataFromFirestore() {
    if (!currentUser) return false;
    try {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists) {
            const data = doc.data().data;
            if (data) {
                Object.keys(data).forEach(key => {
                    if (key !== 'lastUpdated' && key !== 'currentId') appData[key] = data[key];
                });
                if (data.currentId) appData.currentId = data.currentId;
                localStorage.setItem('yas_arm_data', JSON.stringify(appData));
                showToast('📥 Данные загружены', 'success');
                return true;
            }
        } else {
            await saveDataToFirestore();
        }
        return false;
    } catch (error) {
        console.error('Firestore load error:', error);
        return false;
    }
}

// ================================================================
//  43. ГЛАВНЫЙ РЕНДЕР
// ================================================================
function renderAll() {
    try {
        renderParcels();
        renderRPO();
        renderServices();
        renderGoods();
        renderGoodsStock();
        renderGoodsReceipt();
        renderGoodsWriteoff();
        renderGoodsMove();
        renderGoodsReturn();
        renderGoodsUtil();
        renderDelivery();
        renderDeliveryReturn();
        renderLottery();
        renderInsurance();
        renderSIM();
        renderDigital();
        renderTelegram();
        renderCopy();
        renderPension();
        renderCityPayments();
        renderUtilityPayments();
        renderWithdrawHistory();
        renderDepositHistory();
        renderIncoming();
        renderDocuments();
        renderCapacity();
        renderInvoice();
        renderDriver();
        renderPostmanTasks();
        renderStorageJournal();
        renderAddressStorage();
        renderReturnForward();
        renderCashReport();
        renderReport2ap();
        renderGoodsReport();
        renderServiceCash();
        updateReportStats();
        updateServiceStats();
        updateCartBadge();
        updateCityCartBadge();
        renderCart();
        renderRPOMovement();
        renderJournal();
    } catch (e) {
        console.error('renderAll error:', e);
    }
}

// ================================================================
//  44. НАВИГАЦИЯ И ТЕМА
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById('themeToggle');
        if (btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
    }

    document.querySelectorAll('.card-3d[data-tilt]').forEach(card => {
        card.style.setProperty('--mouse-x', '50%');
        card.style.setProperty('--mouse-y', '50%');
        card.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            this.style.setProperty('--mouse-x', (x / rect.width) * 100 + '%');
            this.style.setProperty('--mouse-y', (y / rect.height) * 100 + '%');
            const rotateX = ((y - centerY) / centerY) * -12;
            const rotateY = ((x - centerX) / centerX) * 12;
            this.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px) scale(1.02)`;
            this.style.boxShadow = '0 20px 60px rgba(0,0,0,0.35), 0 0 40px rgba(240,180,41,0.08)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)';
            this.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
            this.style.setProperty('--mouse-x', '50%');
            this.style.setProperty('--mouse-y', '50%');
        });
    });

    applyMasks(document);

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const df = document.getElementById('searchDateFrom');
    const dt = document.getElementById('searchDateTo');
    if (df) df.value = firstDay.toISOString().split('T')[0];
    if (dt) dt.value = now.toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    const sd = document.getElementById('serviceDate');
    const cd = document.getElementById('creditDate');
    if (sd) sd.value = today;
    if (cd) cd.value = today;

    document.querySelectorAll('.nav-menu a[data-page]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
            const target = document.getElementById('page-' + page);
            if (target) target.classList.add('active');
            document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('sidebar').classList.remove('open');
            saveUIPosition();
        });
    });

    document.querySelectorAll('.tabs-header .tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const parent = this.closest('.tabs-container');
            parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const target = document.getElementById(this.dataset.tab);
            if (target) target.classList.add('active');
            saveUIPosition();
        });
    });

    document.querySelectorAll('.sub-tabs-grid .sub-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const parent = this.closest('.tab-content');
            parent.querySelectorAll('.sub-tabs-grid .sub-tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            parent.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
            const target = document.getElementById(this.dataset.subtab);
            if (target) target.classList.add('active');
            saveUIPosition();
        });
    });

    initData();
    renderRPOMovement();
    renderJournal();
});

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('themeToggle');
    body.classList.toggle('dark-mode');
    if (body.classList.contains('dark-mode')) {
        btn.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', 'dark');
        showToast('🌙 Тёмная тема', 'info');
    } else {
        btn.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', 'light');
        showToast('☀️ Светлая тема', 'info');
    }
}

console.log('🏤 v13.0 — финальная версия');
