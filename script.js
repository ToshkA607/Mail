// ================================================================
//  1. АВТОРИЗАЦИЯ
// ================================================================
const VALID_KEYS = ['OPERATOR-2026', 'ADMIN-2026', 'DIRECTOR-2026', 'MASTER-2026', 'STAFF-001', 'STAFF-002'];

function handleLogin(e) {
    e.preventDefault();
    const key = document.getElementById('loginKey').value.trim();
    if (!key) { document.getElementById('authError').textContent = '❌ Введите ключ доступа!'; return false; }
    if (VALID_KEYS.includes(key)) {
        let role = 'Сотрудник отделения', name = 'Сотрудник';
        if (key.includes('ADMIN')) { role = 'Администратор'; name = 'Администратор'; }
        else if (key.includes('DIRECTOR')) { role = 'Руководитель'; name = 'Руководитель'; }
        else if (key.includes('MASTER')) { role = 'Мастер поддержки'; name = 'Мастер'; }
        else if (key.includes('OPERATOR')) { role = 'Оператор'; name = 'Оператор'; }
        else if (key.includes('STAFF')) { role = 'Сотрудник отделения'; name = 'Сотрудник'; }
        
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('sidebar').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('displayName').textContent = name;
        document.getElementById('displayRole').textContent = role;
        document.getElementById('avatarLetter').textContent = name.charAt(0).toUpperCase();
        
        document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
        const firstPage = document.querySelector('.page-section');
        if (firstPage) firstPage.classList.add('active');
        
        initData();
        renderAll();
        showToast('Добро пожаловать, ' + name + '!', 'success');
        return false;
    } else {
        document.getElementById('authError').textContent = '❌ Неверный ключ доступа!';
        return false;
    }
}

function logout() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('authError').textContent = '';
    showToast('Вы вышли из системы', 'info');
}

// ================================================================
//  2. ЗАЯВКА НА ДОСТУП
// ================================================================
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        const form = modal.querySelector('form');
        if (form) form.reset();
        const success = modal.querySelector('.request-success');
        if (success) success.classList.remove('active');
        const formEl = modal.querySelector('form');
        if (formEl) formEl.style.display = 'block';
        if (id === 'capacityEditModal') {
            fillCapacityEditSelect();
        }
        if (id === 'driverTransferModal') {
            fillDriverTransferSelects();
        }
        if (id === 'paymentHistoryModal') {
            fillHistoryModal();
        }
        if (id === 'parcelModal') {
            setTimeout(calcParcelPrice, 100);
        }
        if (id === 'rpoModal') {
            setTimeout(calcRPOPrice, 100);
        }
        if (id === 'telegramModal') {
            setTimeout(() => {
                document.getElementById('tgWordCount').textContent = '0';
                document.getElementById('tgPriceDisplay').textContent = '0';
            }, 100);
        }
        if (id === 'extraServiceModal') {
            fillExtraServiceSelect();
        }
    }
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
    
    const form = document.getElementById('requestForm');
    const formData = new FormData(form);
    
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
    btn.disabled = true;
    
    // ЗДЕСЬ ЗАМЕНИТЕ ССЫЛКУ
    fetch('https://formspree.io/f/xjyvvgbp', {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'application/json'
        }
    })
    .then(response => {
        if (response.ok) {
            document.getElementById('requestForm').style.display = 'none';
            document.getElementById('requestSuccess').classList.add('active');
            showToast('Заявка отправлена! Ключ придёт на почту.', 'success');
        } else {
            showToast('Ошибка при отправке заявки. Попробуйте позже.', 'error');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    })
    .catch(error => {
        showToast('Ошибка соединения. Проверьте интернет.', 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
    
    return false;
}

// ================================================================
//  3. КОРЗИНА
// ================================================================
let cart = [];
let cityCart = [];
let shiftOpen = false;
let shiftNumber = 0;
let selectedPaymentMethod = null;

function toggleCart() {
    document.getElementById('cartSidebar').classList.toggle('open');
    renderCart();
}

function addToCart(productId) {
    const product = appData.products.find(p => p.id === productId);
    if (!product) {
        showToast('Товар не найден!', 'error');
        return;
    }
    if (product.qty <= 0) {
        showToast('Товара нет в наличии', 'error');
        return;
    }
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        if (existing.qty >= product.qty) {
            showToast('Недостаточно товара на складе!', 'error');
            return;
        }
        existing.qty++;
    } else {
        cart.push({ 
            id: productId, 
            name: product.name, 
            price: product.price, 
            qty: 1,
            category: product.category,
            total: product.price
        });
    }
    updateCartBadge();
    renderCart();
    showToast(product.name + ' добавлен в корзину', 'success');
}

function addToCartFromGoods() {
    const search = document.getElementById('goodsSearch')?.value?.toLowerCase() || '';
    let filtered = appData.products;
    if (goodsFilter !== 'all') {
        const map = { 
            'openki': 'Немаркированные открытки', 
            'calendars': 'Календари', 
            'konverty': 'Немаркированные конверты', 
            'upakovka': 'Упаковка', 
            'hoztovary': 'Хозяйственные товары', 
            'electronics': 'Электроника', 
            'food': 'Питание' 
        };
        filtered = filtered.filter(p => p.category === map[goodsFilter]);
    }
    if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
    
    if (filtered.length === 0) {
        showToast('Нет товаров для добавления', 'warning');
        return;
    }
    
    let added = 0;
    filtered.forEach(p => {
        if (p.qty > 0) {
            const existing = cart.find(item => item.id === p.id);
            if (existing) {
                if (existing.qty < p.qty) {
                    existing.qty++;
                    added++;
                }
            } else {
                cart.push({ 
                    id: p.id, 
                    name: p.name, 
                    price: p.price, 
                    qty: 1,
                    category: p.category,
                    total: p.price
                });
                added++;
            }
        }
    });
    
    if (added > 0) {
        updateCartBadge();
        renderCart();
        showToast(`Добавлено ${added} товаров в корзину`, 'success');
    } else {
        showToast('Все товары уже в корзине или нет в наличии', 'info');
    }
}

function removeFromCart(productId) {
    const index = cart.findIndex(item => item.id === productId);
    if (index === -1) return;
    
    if (cart[index].qty > 1) {
        cart[index].qty--;
        cart[index].total = cart[index].price * cart[index].qty;
    } else {
        cart.splice(index, 1);
    }
    updateCartBadge();
    renderCart();
}

function removeItemFromCart(index) {
    if (index < cart.length) {
        const item = cart[index];
        if (item.qty > 1) {
            item.qty--;
            item.total = item.price * item.qty;
        } else {
            cart.splice(index, 1);
        }
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
    if (cart.length === 0 && cityCart.length === 0) {
        showToast('Корзина уже пуста', 'info');
        return;
    }
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
            qty: 1,
            isCityItem: true,
            cityData: item
        }))
    ];
    
    if (allItems.length === 0) {
        body.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:40px 0;">Корзина пуста</p>';
        totalEl.textContent = '0 ₽';
        const paymentBtns = document.querySelector('.payment-buttons');
        if (paymentBtns) paymentBtns.remove();
        return;
    }
    
    let total = 0;
    body.innerHTML = allItems.map((item, idx) => {
        const sum = (item.price || 0) * (item.qty || 1);
        total += sum;
        const isCity = item.isCityItem;
        return `
            <div class="cart-item">
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    <div class="item-detail">${(item.price || 0).toLocaleString('ru-RU')} ₽ × ${item.qty || 1} = ${sum.toLocaleString('ru-RU')} ₽</div>
                    ${isCity ? '<div style="font-size:10px;color:var(--accent);">🛒 Из системы "Город"</div>' : ''}
                </div>
                <button class="item-remove" onclick="removeItemFromCart(${idx})"><i class="fas fa-minus-circle"></i></button>
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
    const allItems = [...cart, ...cityCart];
    if (allItems.length === 0) {
        showToast('Корзина пуста!', 'warning');
        return;
    }
    selectedPaymentMethod = 'QR-код / СБП';
    showToast('💳 Выбран способ оплаты: QR-код / СБП. Нажмите "Оформить покупку" для подтверждения.', 'info');
    document.querySelectorAll('.payment-buttons .btn').forEach(b => b.style.opacity = '0.5');
    document.querySelector('.payment-buttons .btn-primary')?.style.setProperty('opacity', '1', 'important');
}

function payWithCard() {
    const allItems = [...cart, ...cityCart];
    if (allItems.length === 0) {
        showToast('Корзина пуста!', 'warning');
        return;
    }
    selectedPaymentMethod = 'Банковская карта';
    showToast('💳 Выбран способ оплаты: Банковская карта. Нажмите "Оформить покупку" для подтверждения.', 'info');
    document.querySelectorAll('.payment-buttons .btn').forEach(b => b.style.opacity = '0.5');
    document.querySelector('.payment-buttons .btn-info')?.style.setProperty('opacity', '1', 'important');
}

function payWithCash() {
    const allItems = [...cart, ...cityCart];
    if (allItems.length === 0) {
        showToast('Корзина пуста!', 'warning');
        return;
    }
    selectedPaymentMethod = 'Наличные';
    showToast('💳 Выбран способ оплаты: Наличные. Нажмите "Оформить покупку" для подтверждения.', 'info');
    document.querySelectorAll('.payment-buttons .btn').forEach(b => b.style.opacity = '0.5');
    document.querySelector('.payment-buttons .btn-success')?.style.setProperty('opacity', '1', 'important');
}

function checkoutCart() {
    const allItems = [...cart, ...cityCart];
    if (allItems.length === 0) {
        showToast('Корзина пуста!', 'warning');
        return;
    }
    
    if (!selectedPaymentMethod) {
        showToast('⚠️ Сначала выберите способ оплаты!', 'warning');
        return;
    }
    
    let total = 0;
    
    const itemsToProcess = [...cart];
    itemsToProcess.forEach(item => {
        total += item.price * item.qty;
        const product = appData.products.find(p => p.id === item.id);
        if (product) {
            product.qty -= item.qty;
            if (product.qty < 0) product.qty = 0;
            product.total = product.price * product.qty;
            if (product.qty === 0) product.status = 'Нет в наличии';
        }
        const stock = appData.goodsStock.find(g => g.name === item.name);
        if (stock) {
            stock.qty -= item.qty;
            if (stock.qty < 0) stock.qty = 0;
        }
        const report = appData.goodsReport.find(g => g.name === item.name);
        if (report) {
            report.outcome += item.qty;
            report.balance -= item.qty;
            if (report.balance < 0) report.balance = 0;
        }
    });
    
    const cityItemsToProcess = [...cityCart];
    cityItemsToProcess.forEach(item => {
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
    const totalEl = document.getElementById('cartTotal');
    if (body) {
        body.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:40px 0;">Корзина пуста</p>';
    }
    if (totalEl) {
        totalEl.textContent = '0 ₽';
    }
    const paymentBtns = document.querySelector('.payment-buttons');
    if (paymentBtns) paymentBtns.remove();
    
    document.querySelectorAll('.payment-buttons .btn').forEach(b => b.style.opacity = '1');
    
    showToast('✅ Покупка оформлена! Способ оплаты: ' + methodText + '. Сумма: ' + total.toLocaleString('ru-RU') + ' ₽', 'success');
}

// ================================================================
//  4. ДАННЫЕ
// ================================================================
let appData = {};
let goodsFilter = 'all';

function initData() {
    if (localStorage.getItem('yas_arm_data')) {
        appData = JSON.parse(localStorage.getItem('yas_arm_data'));
        const needed = ['products', 'goodsStock', 'goodsReceipt', 'goodsWriteoff', 'goodsMove', 'goodsReturn', 'goodsUtil'];
        let needReset = false;
        needed.forEach(key => { if (!appData[key]) needReset = true; });
        if (needReset) {
            appData = getDefaultData();
            localStorage.setItem('yas_arm_data', JSON.stringify(appData));
        }
        return;
    }
    appData = getDefaultData();
    localStorage.setItem('yas_arm_data', JSON.stringify(appData));
}

function getDefaultData() {
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
            { id: 1, name: 'Упаковка подарочная', price: 150, desc: 'Красивая упаковка для подарка' },
            { id: 2, name: 'Страхование', price: 0, desc: '0.5% от стоимости отправления' },
            { id: 3, name: 'СМС-уведомление', price: 35, desc: 'Уведомление о статусе' },
            { id: 4, name: 'Доставка на дом', price: 200, desc: 'Курьерская доставка до двери' },
            { id: 5, name: 'Электронная подпись', price: 150, desc: 'Подтверждение получения электронной подписью' },
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
            { id: 2, track: 'TRK-2026-002', receiver: 'Козлова Е.Д.', sender: 'Сидоров С.С.', type: 'Письмо', status: 'Ожидает', date: '—' },
            { id: 3, track: 'TRK-2026-004', receiver: 'Морозова Н.С.', sender: 'Попов Д.А.', type: 'EMS', status: 'Ожидает', date: '—' },
            { id: 4, track: 'TRK-2026-006', receiver: 'Соколова М.П.', sender: 'Фёдоров Ф.Ф.', type: '1-й класс', status: 'Вручено', date: '2026-06-15' },
            { id: 5, track: 'TRK-2026-010', receiver: 'Андреева И.Д.', sender: 'Николаев Н.Н.', type: 'EMS', status: 'Вручено', date: '2026-06-20' },
            { id: 6, track: 'TRK-2026-008', receiver: 'Дмитриева О.С.', sender: 'Алексеев А.А.', type: 'Посылка', status: 'Ожидает', date: '—' },
        ],
        deliveryReturn: [
            { id: 1, track: 'TRK-2026-003', sender: 'Смирнов А.В.', receiver: 'Кузнецова О.И.', senderAddress: 'г. Москва, ул. Ленина, д.10', receiverAddress: 'г. Москва, ул. Тверская, д.15', date: '2026-06-18', status: 'В обработке' },
        ],
        lottery: [
            { id: 1, ticket: 'LT-001', client: 'Иванов И.И.', amount: 100, date: '2026-06-20', status: 'Выигрыш' },
            { id: 2, ticket: 'LT-002', client: 'Петров П.П.', amount: 50, date: '2026-06-21', status: 'Ожидает' },
            { id: 3, ticket: 'LT-003', client: 'Сидорова Е.М.', amount: 200, date: '2026-06-22', status: 'Выигрыш' },
            { id: 4, ticket: 'LT-004', client: 'Козлов В.А.', amount: 75, date: '2026-06-23', status: 'Ожидает' },
            { id: 5, ticket: 'LT-005', client: 'Морозова Н.С.', amount: 150, date: '2026-06-24', status: 'Выигрыш' },
            { id: 6, ticket: 'LT-006', client: 'Смирнов А.В.', amount: 300, date: '2026-06-25', status: 'Ожидает' },
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
            { id: 2, payer: 'Петрова О.Н.', service: 'Интернет', amount: 650, date: '2026-06-21', status: 'Оплачено' },
            { id: 3, payer: 'Сидоров С.С.', service: 'Коммунальные услуги', amount: 2340, date: '2026-06-22', status: 'Оплачено' },
            { id: 4, payer: 'Козлова Е.Д.', service: 'Штрафы', amount: 500, date: '2026-06-23', status: 'Оплачено' },
            { id: 5, payer: 'Морозова Н.С.', service: 'Налоги', amount: 1500, date: '2026-06-24', status: 'Ожидает' },
            { id: 6, payer: 'Смирнов А.В.', service: 'Кредит', amount: 5000, date: '2026-06-25', status: 'Оплачено' },
            { id: 7, payer: 'Васильев В.В.', service: 'Мусор', amount: 380, date: '2026-06-26', status: 'Оплачено' },
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
            { id: 2, track: 'IN-002', sender: 'СберЛогистика', date: '2026-06-19', type: 'Бандероль', status: 'Принято' },
            { id: 3, track: 'IN-003', sender: 'DHL Express', date: '2026-06-20', type: 'EMS', status: 'На сортировке' },
            { id: 4, track: 'IN-004', sender: 'Почта России', date: '2026-06-21', type: 'Письмо', status: 'Принято' },
            { id: 5, track: 'IN-005', sender: 'СДЭК', date: '2026-06-22', type: 'Посылка', status: 'На сортировке' },
            { id: 6, track: 'IN-006', sender: 'Почта России', date: '2026-06-23', type: 'Бандероль', status: 'Принято' },
        ],
        documents: [
            { id: 1, number: 'АКТ-001', type: 'Акт', sender: 'Почта России', date: '2026-06-18' },
            { id: 2, number: 'ИЗВ-001', type: 'Извещение', sender: 'СберЛогистика', date: '2026-06-19' },
        ],
        capacity: [
            { id: 1, name: 'Емкость №1', items: 'TRK-001, TRK-002', weight: 8.5, status: 'Готова' },
            { id: 2, name: 'Емкость №2', items: 'TRK-004', weight: 3.2, status: 'В процессе' },
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
            { id: 2, track: 'TRK-2026-002', receiver: 'Козлова Е.Д.', sender: 'Сидоров С.С.', date: '2026-06-05', status: 'В пути' },
            { id: 3, track: 'TRK-2026-003', receiver: 'Кузнецова О.И.', sender: 'Смирнов А.В.', date: '2026-06-10', status: 'Принято' },
            { id: 4, track: 'TRK-2026-004', receiver: 'Морозова Н.С.', sender: 'Попов Д.А.', date: '2026-06-12', status: 'В пути' },
            { id: 5, track: 'TRK-2026-005', receiver: 'Новикова А.И.', sender: 'Васильев В.В.', date: '2026-06-14', status: 'Принято' },
            { id: 6, track: 'TRK-2026-006', receiver: 'Соколова М.П.', sender: 'Фёдоров Ф.Ф.', date: '2026-06-15', status: 'Вручено' },
            { id: 7, track: 'TRK-2026-007', receiver: 'Григорьева Е.В.', sender: 'Михайлов М.М.', date: '2026-06-16', status: 'Задерживается' },
            { id: 8, track: 'TRK-2026-008', receiver: 'Дмитриева О.С.', sender: 'Алексеев А.А.', date: '2026-06-17', status: 'В пути' },
            { id: 9, track: 'TRK-2026-009', receiver: 'Борисова Т.Н.', sender: 'Егоров Е.Е.', date: '2026-06-18', status: 'Принято' },
            { id: 10, track: 'TRK-2026-010', receiver: 'Андреева И.Д.', sender: 'Николаев Н.Н.', date: '2026-06-19', status: 'Вручено' },
        ],
        addressStorage: [
            { id: 1, cell: 'A-01', track: 'TRK-2026-003', receiver: 'Кузнецова О.И.', term: '2026-07-01', status: 'Хранится' },
            { id: 2, cell: 'B-03', track: 'TRK-2026-005', receiver: 'Волкова М.И.', term: '2026-07-15', status: 'Хранится' },
        ],
        returnForward: [
            { id: 1, track: 'TRK-2026-007', sender: 'Иванов И.И.', receiver: '—', operation: 'Возврат' },
        ],
        cashReport: [
            { id: 1, operator: 'Иванов И.И.', income: 15200, outcome: 5000, date: '2026-06-20', status: 'Закрыта' },
            { id: 2, operator: 'Петров П.П.', income: 8200, outcome: 3000, date: '2026-06-21', status: 'Закрыта' },
            { id: 3, operator: 'Сидорова Е.М.', income: 12500, outcome: 4500, date: '2026-06-22', status: 'Закрыта' },
            { id: 4, operator: 'Козлов В.А.', income: 9300, outcome: 2800, date: '2026-06-23', status: 'Закрыта' },
            { id: 5, operator: 'Морозова Н.С.', income: 17800, outcome: 6200, date: '2026-06-24', status: 'Закрыта' },
            { id: 6, operator: 'Смирнов А.В.', income: 21000, outcome: 8000, date: '2026-06-25', status: 'Закрыта' },
        ],
        report2ap: [
            { date: '2026-06-01', incoming: 12, outgoing: 10, type: 'Письма' },
            { date: '2026-06-01', incoming: 5, outgoing: 4, type: 'Газеты' },
        ],
        rpoReport: [
            { track: 'RPO-001', type: 'Заказное письмо', sender: 'Иванов И.И.', receiver: 'Петров П.П.', date: '2026-06-01', status: 'Вручено' },
            { track: 'RPO-002', type: 'Ценная посылка', sender: 'Сидоров С.С.', receiver: 'Козлова Е.Д.', date: '2026-06-05', status: 'В пути' },
        ],
        goodsReport: [
            { id: 1, name: 'Открытка "С днём рождения"', income: 50, outcome: 25, balance: 25 },
            { id: 2, name: 'Календарь настенный 2027', income: 20, outcome: 10, balance: 10 },
        ],
        serviceCash: [
            { id: 1, operator: 'Иванов И.И.', income: 0, outcome: 0, date: '2026-06-20', status: 'Закрыта' },
        ],
        incidents: [
            { id: 1, subject: 'Не сканируется штрих-код', description: 'Сканер перестал считывать после обновления', priority: 'Высокий', status: 'В работе', assignee: 'Мастер Иванов', date: '2026-06-18' },
        ],
        currentId: {
            parcels: 11, rpo: 4, products: 31, goodsStock: 13, goodsReceipt: 2, goodsWriteoff: 2,
            goodsMove: 2, goodsReturn: 2, goodsUtil: 2, delivery: 7, deliveryReturn: 2,
            lottery: 7, insurance: 2, sim: 2, digital: 2, telegram: 2, copy: 2,
            pension: 2, cityPayments: 8, utilityPayments: 2, withdrawHistory: 2,
            depositHistory: 2, incoming: 7, documents: 3, capacity: 3, invoice: 2,
            driver: 2, postmanTasks: 2, storageJournal: 11, addressStorage: 3,
            returnForward: 2, cashReport: 7, incidents: 2
        }
    };
}

function saveData() {
    localStorage.setItem('yas_arm_data', JSON.stringify(appData));
}

function getNextId(key) {
    if (!appData.currentId) appData.currentId = {};
    if (!appData.currentId[key]) appData.currentId[key] = 1;
    return appData.currentId[key]++;
}

// ================================================================
//  5. РЕНДЕРИНГ (все функции)
// ================================================================

// --- Функции рендеринга для товаров ---
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
            <td><strong>${r.name}</strong></td>
            <td><span class="badge badge-info">${r.category}</span></td>
            <td>${r.qty}</td>
            <td>${r.price} ₽</td>
            <td>${r.date}</td>
            <td>${r.user || '—'}</td>
        </tr>
    `).join('');
}

function saveGoodsReceipt(e) {
    e.preventDefault();
    const name = document.getElementById('grName').value.trim();
    const category = document.getElementById('grCategory').value;
    const qty = parseInt(document.getElementById('grQty').value) || 0;
    const price = parseFloat(document.getElementById('grPrice').value) || 0;
    if (!name || qty <= 0) { showToast('Заполните все поля!', 'error'); return false; }
    appData.goodsReceipt.push({
        id: getNextId('goodsReceipt'),
        name: name,
        category: category,
        qty: qty,
        price: price,
        date: new Date().toISOString().split('T')[0],
        user: document.getElementById('displayName')?.textContent || 'Сотрудник'
    });
    const stock = appData.goodsStock.find(g => g.name === name);
    if (stock) {
        stock.qty += qty;
    } else {
        appData.goodsStock.push({
            id: getNextId('goodsStock'),
            name: name,
            category: category,
            qty: qty,
            warehouse: 'Склад №1'
        });
    }
    const report = appData.goodsReport.find(g => g.name === name);
    if (report) {
        report.income += qty;
        report.balance += qty;
    } else {
        appData.goodsReport.push({
            id: getNextId('goodsReport'),
            name: name,
            income: qty,
            outcome: 0,
            balance: qty
        });
    }
    saveData();
    closeModal('goodsReceiptModal');
    renderAll();
    showToast('Товар оприходован!', 'success');
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
            <td><strong>${w.name}</strong></td>
            <td><span class="badge badge-info">${w.category}</span></td>
            <td>${w.qty}</td>
            <td>${w.date}</td>
            <td>${w.user || '—'}</td>
        </tr>
    `).join('');
}

function saveGoodsWriteoff(e) {
    e.preventDefault();
    const name = document.getElementById('woName').value.trim();
    const category = document.getElementById('woCategory').value;
    const qty = parseInt(document.getElementById('woQty').value) || 0;
    const reason = document.getElementById('woReason').value.trim();
    if (!name || qty <= 0) { showToast('Заполните все поля!', 'error'); return false; }
    appData.goodsWriteoff.push({
        id: getNextId('goodsWriteoff'),
        name: name,
        category: category,
        qty: qty,
        date: new Date().toISOString().split('T')[0],
        user: document.getElementById('displayName')?.textContent || 'Сотрудник',
        reason: reason || 'Не указана'
    });
    const stock = appData.goodsStock.find(g => g.name === name);
    if (stock) {
        stock.qty -= qty;
        if (stock.qty < 0) stock.qty = 0;
    }
    const report = appData.goodsReport.find(g => g.name === name);
    if (report) {
        report.outcome += qty;
        report.balance -= qty;
        if (report.balance < 0) report.balance = 0;
    }
    saveData();
    closeModal('goodsWriteoffModal');
    renderAll();
    showToast('Товар списан!', 'success');
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
            <td><strong>${m.name}</strong></td>
            <td>${m.from}</td>
            <td>${m.to}</td>
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
    if (!name || !from || !to || qty <= 0) { showToast('Заполните все поля!', 'error'); return false; }
    appData.goodsMove.push({
        id: getNextId('goodsMove'),
        name: name,
        from: from,
        to: to,
        qty: qty,
        date: new Date().toISOString().split('T')[0]
    });
    const stockFrom = appData.goodsStock.find(g => g.name === name && g.warehouse === from);
    const stockTo = appData.goodsStock.find(g => g.name === name && g.warehouse === to);
    if (stockFrom) {
        stockFrom.qty -= qty;
        if (stockFrom.qty < 0) stockFrom.qty = 0;
    }
    if (stockTo) {
        stockTo.qty += qty;
    } else {
        appData.goodsStock.push({
            id: getNextId('goodsStock'),
            name: name,
            category: appData.products.find(p => p.name === name)?.category || 'Другое',
            qty: qty,
            warehouse: to
        });
    }
    saveData();
    closeModal('goodsMoveModal');
    renderAll();
    showToast('Товар перемещён!', 'success');
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
                    <div style="font-size:11px;color:var(--gray-500);">Всего наименований</div>
                    <div style="font-size:20px;font-weight:700;color:var(--primary);">${appData.goodsStock.length}</div>
                </div>
                <div style="background:white;padding:12px;border-radius:var(--radius-sm);text-align:center;">
                    <div style="font-size:11px;color:var(--gray-500);">Общее количество</div>
                    <div style="font-size:20px;font-weight:700;color:var(--primary);">${totalItems} шт.</div>
                </div>
                <div style="background:white;padding:12px;border-radius:var(--radius-sm);text-align:center;">
                    <div style="font-size:11px;color:var(--gray-500);">Общая стоимость</div>
                    <div style="font-size:20px;font-weight:700;color:var(--accent);">${totalValue.toLocaleString('ru-RU')} ₽</div>
                </div>
            </div>
            <div style="margin-top:12px;font-size:13px;color:var(--gray-600);">
                <i class="fas fa-calendar"></i> Дата инвентаризации: ${new Date().toLocaleString('ru-RU')}
            </div>
        </div>
    `;
    showToast('Инвентаризация завершена!', 'success');
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
            <td><strong>${r.name}</strong></td>
            <td>${r.client}</td>
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
    if (!client || !name || amount <= 0) { showToast('Заполните все поля!', 'error'); return false; }
    appData.goodsReturn.push({
        id: getNextId('goodsReturn'),
        client: client,
        name: name,
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        status: 'Оформлен',
        reason: reason || 'Не указана'
    });
    saveData();
    closeModal('goodsReturnModal');
    renderAll();
    showToast('Возврат оформлен!', 'success');
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
            <td><strong>${u.name}</strong></td>
            <td>${u.qty}</td>
            <td>${u.date}</td>
            <td>${u.user || '—'}</td>
        </tr>
    `).join('');
}

function saveGoodsUtil(e) {
    e.preventDefault();
    const name = document.getElementById('utName').value.trim();
    const qty = parseInt(document.getElementById('utQty').value) || 0;
    const reason = document.getElementById('utReason').value.trim();
    if (!name || qty <= 0) { showToast('Заполните все поля!', 'error'); return false; }
    appData.goodsUtil.push({
        id: getNextId('goodsUtil'),
        name: name,
        qty: qty,
        date: new Date().toISOString().split('T')[0],
        user: document.getElementById('displayName')?.textContent || 'Сотрудник',
        reason: reason || 'Не указана'
    });
    saveData();
    closeModal('goodsUtilModal');
    renderAll();
    showToast('Товар утилизирован!', 'success');
    return false;
}

function saveExtraService(e) {
    e.preventDefault();
    const name = document.getElementById('esName').value.trim();
    const price = parseFloat(document.getElementById('esPrice').value) || 0;
    const desc = document.getElementById('esDesc').value.trim();
    if (!name) { showToast('Введите название услуги!', 'error'); return false; }
    appData.services.push({
        id: getNextId('services'),
        name: name,
        price: price,
        desc: desc || '—'
    });
    saveData();
    closeModal('extraServiceModal');
    renderServices();
    showToast('Услуга добавлена!', 'success');
    return false;
}

// ================================================================
//  ГЛАВНАЯ ФУНКЦИЯ РЕНДЕРИНГА
// ================================================================
function renderAll() {
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
    renderRPOReport();
    renderGoodsReport();
    renderServiceCash();
    renderIncidents();
    renderLotteryTable();
    renderInsuranceTable();
    renderSIMTable();
    renderDigitalTable();
    renderTelegramTable();
    renderPensionTable();
    renderCityPaymentsTable();
    renderUtilityTable();
    updateReportStats();
    updateBackStats();
    updateServiceStats();
    updateCartBadge();
    updateCityCartBadge();
    renderCart();
}

function renderIncidents() {}

// ================================================================
//  6. РАСЧЁТНЫЕ ФУНКЦИИ
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
    const wordCount = document.getElementById('tgWordCount');
    const priceDisplay = document.getElementById('tgPriceDisplay');
    if (wordCount) wordCount.textContent = words;
    if (priceDisplay) priceDisplay.textContent = price;
    return price;
}

// ================================================================
//  7. ДОП. УСЛУГИ
// ================================================================
let extraCart = [];

function fillExtraServiceSelect() {}

function addExtraServiceToCart(serviceId) {
    const service = appData.services.find(s => s.id === serviceId);
    if (!service) return;
    extraCart.push({ ...service });
    updateExtraCartInfo();
    showToast('Услуга "' + service.name + '" добавлена в корзину!', 'success');
}

function addExtraToCart() {
    if (extraCart.length === 0) { showToast('Нет услуг для добавления', 'warning'); return; }
    extraCart.forEach(s => {
        cart.push({
            id: 'extra-' + Date.now() + '-' + s.id,
            name: 'Услуга: ' + s.name,
            category: 'Услуги',
            qty: 1,
            price: s.price,
            total: s.price,
            status: 'В корзине'
        });
    });
    const total = extraCart.reduce((sum, s) => sum + s.price, 0);
    extraCart = [];
    updateExtraCartInfo();
    updateCartBadge();
    renderCart();
    showToast('Услуги добавлены в корзину! Сумма: ' + total.toLocaleString('ru-RU') + ' ₽', 'success');
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

// ================================================================
//  8. КОММУНАЛЬНЫЕ ПЛАТЕЖИ
// ================================================================
function loadUtilityData() {
    const dataDiv = document.getElementById('utilityData');
    if (dataDiv) dataDiv.style.display = 'block';
}

function payUtilityNew() {
    const account = document.getElementById('utilityAccount').value.trim();
    const payer = document.getElementById('utilityPayer').value.trim();
    const service = document.getElementById('utilityService')?.value || 'Коммунальные услуги';
    const amount = document.getElementById('utilPayAmount').value;
    
    if (!account) { showToast('Введите лицевой счёт!', 'error'); return; }
    if (!payer) { showToast('Введите ФИО плательщика!', 'error'); return; }
    if (!amount || parseFloat(amount) <= 0) { showToast('Введите сумму платежа!', 'error'); return; }
    
    appData.utilityPayments.push({
        id: getNextId('utilityPayments'),
        payer: payer,
        service: service + ' (счёт: ' + account + ')',
        amount: parseFloat(amount),
        date: new Date().toISOString().split('T')[0],
        status: 'Оплачено'
    });
    saveData();
    renderUtilityPayments();
    showToast('Оплата коммунальных услуг выполнена! Сумма: ' + parseFloat(amount).toLocaleString('ru-RU') + ' ₽', 'success');
    document.getElementById('utilPayAmount').value = '';
    document.getElementById('utilityAccount').value = '';
    document.getElementById('utilityPayer').value = '';
}

function renderUtilityPayments() {
    const tbody = document.getElementById('utilityPaymentsBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.utilityPayments || appData.utilityPayments.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.utilityPayments.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.id}</td>
            <td>${p.payer}</td>
            <td>${p.service}</td>
            <td>${p.amount} ₽</td>
            <td>${p.date}</td>
            <td><span class="badge ${p.status === 'Оплачено' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// ================================================================
//  9. ЭКСПОРТ PDF/WORD/EXCEL (РАБОЧАЯ ВЕРСИЯ)
// ================================================================

function exportToPDF(elementId, filename = 'документ') {
    const table = document.getElementById(elementId);
    if (!table) {
        showToast('Таблица не найдена!', 'error');
        return;
    }
    
    // Проверяем, есть ли строки в таблице
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    
    // Проверяем, не заглушка ли это
    if (rows[0] && rows[0].textContent.includes('Нет данных')) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    
    // Получаем данные из таблицы в виде массива
    const headers = [];
    table.querySelectorAll('thead th').forEach(th => {
        headers.push(th.innerText.trim());
    });
    
    const dataRows = [];
    rows.forEach(tr => {
        const rowData = [];
        tr.querySelectorAll('td').forEach(td => {
            rowData.push(td.innerText.trim());
        });
        dataRows.push(rowData);
    });
    
    // Получаем footer если есть
    const footerData = [];
    const footer = table.querySelector('tfoot');
    if (footer) {
        footer.querySelectorAll('tr').forEach(tr => {
            const rowData = [];
            tr.querySelectorAll('td').forEach(td => {
                rowData.push(td.innerText.trim());
            });
            footerData.push(rowData);
        });
    }
    
    // Строим HTML таблицу вручную
    let tableHTML = '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:12px;">';
    
    // Заголовки
    if (headers.length > 0) {
        tableHTML += '<thead><tr>';
        headers.forEach(h => {
            tableHTML += `<th style="background:#0d2b4a;color:white;padding:6px 10px;text-align:left;border:1px solid #999;">${h}</th>`;
        });
        tableHTML += '</tr></thead>';
    }
    
    // Тело таблицы
    tableHTML += '<tbody>';
    dataRows.forEach(row => {
        tableHTML += '<tr>';
        row.forEach(cell => {
            // Проверяем, есть ли бейдж в ячейке
            let cellContent = cell;
            // Убираем лишние пробелы
            cellContent = cellContent.replace(/\s+/g, ' ').trim();
            tableHTML += `<td style="padding:6px 10px;border:1px solid #999;">${cellContent}</td>`;
        });
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody>';
    
    // Footer
    if (footerData.length > 0) {
        tableHTML += '<tfoot>';
        footerData.forEach(row => {
            tableHTML += '<tr style="background:#e5e7eb;font-weight:700;">';
            row.forEach(cell => {
                tableHTML += `<td style="padding:6px 10px;border:1px solid #999;border-top:2px solid #0d2b4a;">${cell}</td>`;
            });
            tableHTML += '</tr>';
        });
        tableHTML += '</tfoot>';
    }
    
    tableHTML += '</table>';
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Пожалуйста, разрешите всплывающие окна для печати', 'error');
        return;
    }
    
    const styles = `
        * { box-sizing: border-box; }
        body { font-family: 'Inter', Arial, sans-serif; padding: 30px; background: white; margin: 0; }
        .header { display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center; border-bottom: 2px solid #0d2b4a; padding-bottom: 10px; }
        .header h1 { color: #0d2b4a; font-size: 22px; margin: 0; }
        .header p { margin: 0; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
        th, td { border: 1px solid #999; padding: 6px 10px; text-align: left; }
        th { background: #0d2b4a; color: white; font-weight: 600; }
        tr:nth-child(even) { background: #f8f9fa; }
        .footer { margin-top: 30px; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; text-align: center; }
        .badge { display: inline-block; padding: 1px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
        .badge-success { background: #d1fae5; color: #059669; }
        .badge-warning { background: #fef3c7; color: #92400e; }
        .badge-danger { background: #fecaca; color: #dc2626; }
        .badge-info { background: #dbeafe; color: #1e40af; }
        .badge-accent { background: #fef3c7; color: #92400e; }
        .total-row { background: #e5e7eb !important; font-weight: 700; }
        .total-row td { border-top: 2px solid #0d2b4a !important; }
        @media print {
            body { padding: 15px; }
            .header { border-bottom: 2px solid #000; }
            th { background: #333 !important; color: white !important; }
            td { border-color: #666 !important; }
        }
    `;
    
    printWindow.document.write(`
        <html><head><title>${filename}</title>
        <style>${styles}</style>
        </head><body>
        <div class="header">
            <h1>📄 ${filename}</h1>
            <p><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        </div>
        ${tableHTML}
        <div class="footer">Документ сгенерирован автоматически · Почта России</div>
        </body></html>
    `);
    printWindow.document.close();
    
    setTimeout(() => { 
        printWindow.print(); 
        setTimeout(() => { printWindow.close(); }, 1500);
    }, 500);
    showToast(`PDF "${filename}" отправлен на печать!`, 'success');
}

function exportToWord(elementId, filename = 'документ') {
    const table = document.getElementById(elementId);
    if (!table) {
        showToast('Таблица не найдена', 'error');
        return;
    }
    
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    
    if (rows[0] && rows[0].textContent.includes('Нет данных')) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    
    // Получаем данные из таблицы
    const headers = [];
    table.querySelectorAll('thead th').forEach(th => {
        headers.push(th.innerText.trim());
    });
    
    const dataRows = [];
    rows.forEach(tr => {
        const rowData = [];
        tr.querySelectorAll('td').forEach(td => {
            rowData.push(td.innerText.trim());
        });
        dataRows.push(rowData);
    });
    
    const footerData = [];
    const footer = table.querySelector('tfoot');
    if (footer) {
        footer.querySelectorAll('tr').forEach(tr => {
            const rowData = [];
            tr.querySelectorAll('td').forEach(td => {
                rowData.push(td.innerText.trim());
            });
            footerData.push(rowData);
        });
    }
    
    // Строим HTML таблицу
    let tableHTML = '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;">';
    
    if (headers.length > 0) {
        tableHTML += '<thead><tr>';
        headers.forEach(h => {
            tableHTML += `<th style="background:#0d2b4a;color:white;padding:6px 10px;text-align:left;border:1px solid #333;">${h}</th>`;
        });
        tableHTML += '</tr></thead>';
    }
    
    tableHTML += '<tbody>';
    dataRows.forEach(row => {
        tableHTML += '<tr>';
        row.forEach(cell => {
            let cellContent = cell.replace(/\s+/g, ' ').trim();
            // Проверяем, есть ли "бейдж" в тексте
            if (cellContent.includes('Оплачено') || cellContent.includes('Закрыта') || cellContent.includes('Вручено')) {
                // Просто показываем текст
            }
            tableHTML += `<td style="padding:6px 10px;border:1px solid #333;">${cellContent}</td>`;
        });
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody>';
    
    if (footerData.length > 0) {
        tableHTML += '<tfoot>';
        footerData.forEach(row => {
            tableHTML += '<tr style="background:#e5e7eb;font-weight:700;">';
            row.forEach(cell => {
                tableHTML += `<td style="padding:6px 10px;border:1px solid #333;border-top:2px solid #0d2b4a;">${cell}</td>`;
            });
            tableHTML += '</tr>';
        });
        tableHTML += '</tfoot>';
    }
    
    tableHTML += '</table>';
    
    const html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset="utf-8">
        <style>
            body { font-family: 'Inter', Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #333; padding: 6px 10px; text-align: left; }
            th { background: #0d2b4a; color: white; }
            h1 { color: #0d2b4a; }
            .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #0d2b4a; padding-bottom: 10px; }
            .footer { margin-top: 30px; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; text-align: center; }
        </style>
        </head>
        <body>
            <div class="header">
                <h1>📄 ${filename}</h1>
                <p><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</p>
            </div>
            ${tableHTML}
            <div class="footer">Документ сгенерирован автоматически · Почта России</div>
        </body></html>
    `;
    
    const blob = new Blob(['\uFEFF' + html], { type: 'application/msword;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.doc`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`Word документ "${filename}" загружен!`, 'success');
}

function exportToExcelTable(tableId, filename = 'документ') {
    const table = document.getElementById(tableId);
    if (!table) {
        showToast('Таблица для экспорта не найдена', 'error');
        return;
    }
    
    // Проверяем, есть ли библиотека XLSX
    if (typeof XLSX === 'undefined') {
        // Если библиотека не загружена, используем CSV
        exportToExcelCSV(tableId, filename);
        return;
    }
    
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    
    if (rows[0] && rows[0].textContent.includes('Нет данных')) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    
    // Собираем данные в массив
    const data = [];
    
    // Заголовки
    const headers = table.querySelectorAll('thead th');
    if (headers.length > 0) {
        const headerRow = [];
        headers.forEach(th => {
            headerRow.push(th.innerText.trim());
        });
        data.push(headerRow);
    }
    
    // Данные
    rows.forEach(tr => {
        const rowData = [];
        tr.querySelectorAll('td').forEach(td => {
            rowData.push(td.innerText.trim().replace(/\s+/g, ' '));
        });
        data.push(rowData);
    });
    
    // Footer
    const footer = table.querySelector('tfoot');
    if (footer) {
        footer.querySelectorAll('tr').forEach(tr => {
            const rowData = [];
            tr.querySelectorAll('td').forEach(td => {
                rowData.push(td.innerText.trim().replace(/\s+/g, ' '));
            });
            data.push(rowData);
        });
    }
    
    // Создаем книгу
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Устанавливаем ширину колонок
    const colWidths = [];
    if (data.length > 0) {
        for (let i = 0; i < data[0].length; i++) {
            let maxLen = 0;
            for (let j = 0; j < data.length; j++) {
                if (data[j][i]) {
                    const len = String(data[j][i]).length;
                    if (len > maxLen) maxLen = len;
                }
            }
            // Ширина колонки = максимальная длина * 1.2 + 2
            colWidths.push({ wch: Math.max(maxLen * 1.2 + 2, 12) });
        }
    }
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, 'Лист1');
    
    // Сохраняем
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`Excel файл "${filename}" загружен!`, 'success');
}

// Резервная функция для CSV
function exportToExcelCSV(tableId, filename = 'документ') {
    const table = document.getElementById(tableId);
    if (!table) {
        showToast('Таблица для экспорта не найдена', 'error');
        return;
    }
    
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    
    const delimiter = '\t';
    let csv = '';
    
    const headers = table.querySelectorAll('thead th');
    if (headers.length > 0) {
        const headerRow = [];
        headers.forEach(th => {
            headerRow.push(th.innerText.trim());
        });
        csv += headerRow.join(delimiter) + '\n';
    }
    
    rows.forEach(tr => {
        const rowData = [];
        tr.querySelectorAll('td').forEach(td => {
            rowData.push(td.innerText.trim().replace(/\s+/g, ' '));
        });
        csv += rowData.join(delimiter) + '\n';
    });
    
    const footer = table.querySelector('tfoot');
    if (footer) {
        footer.querySelectorAll('tr').forEach(tr => {
            const rowData = [];
            tr.querySelectorAll('td').forEach(td => {
                rowData.push(td.innerText.trim().replace(/\s+/g, ' '));
            });
            csv += rowData.join(delimiter) + '\n';
        });
    }
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`Excel файл "${filename}" загружен!`, 'success');
}


function printMC42() {
    // Ищем всю карточку с результатом
    const content = document.getElementById('mc42Result');
    if (!content) {
        showToast('Элемент не найден', 'error');
        return;
    }
    
    // Проверяем, есть ли данные
    const startEl = document.getElementById('mc42Start');
    if (startEl && startEl.textContent === '0 ₽') {
        showToast('Сначала сформируйте справку!', 'warning');
        return;
    }
    
    // Создаем HTML для печати
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Пожалуйста, разрешите всплывающие окна для печати', 'error');
        return;
    }
    
    // Получаем данные
    const start = document.getElementById('mc42Start')?.textContent || '0 ₽';
    const income = document.getElementById('mc42Income')?.textContent || '0 ₽';
    const end = document.getElementById('mc42End')?.textContent || '0 ₽';
    const date = document.getElementById('mc42DateDisplay')?.textContent || new Date().toISOString().split('T')[0];
    
    const styles = `
        * { box-sizing: border-box; }
        body { font-family: 'Inter', Arial, sans-serif; padding: 30px; background: white; margin: 0; }
        .header { display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center; border-bottom: 2px solid #0d2b4a; padding-bottom: 10px; }
        .header h1 { color: #0d2b4a; font-size: 22px; margin: 0; }
        .header p { margin: 0; color: #555; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-top: 15px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .stat { background: white; padding: 16px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0; }
        .stat-label { font-size: 12px; color: #64748b; }
        .stat-value { font-size: 24px; font-weight: 700; }
        .stat-value.primary { color: #0a1628; }
        .stat-value.success { color: #059669; }
        .stat-value.accent { color: #f0b429; }
        .info { margin-top: 16px; padding: 16px; background: #f1f5f9; border-radius: 10px; font-size: 13px; }
        .footer { margin-top: 30px; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; text-align: center; }
        @media print {
            body { padding: 15px; }
            .header { border-bottom: 2px solid #000; }
        }
    `;
    
    printWindow.document.write(`
        <html><head><title>Справка_МС-42</title>
        <style>${styles}</style>
        </head><body>
        <div class="header">
            <h1>📄 Кассовая справка МС-42</h1>
            <p><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        </div>
        <div class="card">
            <div class="grid">
                <div class="stat">
                    <div class="stat-label">Остаток на начало</div>
                    <div class="stat-value primary">${start}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Приход</div>
                    <div class="stat-value success">${income}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Остаток на конец</div>
                    <div class="stat-value accent">${end}</div>
                </div>
            </div>
            <div class="info">
                <p><strong>Документ:</strong> Кассовая справка МС-42 №124 от ${date}</p>
                <p><strong>Смена:</strong> №124 · Кассир: Иванов И.И.</p>
                <p><strong>Подпись:</strong> ___________________</p>
            </div>
        </div>
        <div class="footer">Документ сгенерирован автоматически · Почта России</div>
        </body></html>
    `);
    printWindow.document.close();
    
    setTimeout(() => { 
        printWindow.print(); 
        setTimeout(() => { printWindow.close(); }, 1500);
    }, 500);
    showToast('Справка МС-42 отправлена на печать!', 'success');
}

function printReport2ap() {
    const table = document.getElementById('report2apTableBody');
    if (!table) {
        showToast('Таблица не найдена', 'error');
        return;
    }
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0 || (rows[0] && rows[0].textContent.includes('Нет данных'))) {
        showToast('Нет данных для печати. Нажмите "Сформировать".', 'warning');
        return;
    }
    exportToPDF('report2apTableBody', 'Отчёт_ф2а-п');
}

function printGoodsReport() { 
    const table = document.getElementById('goodsReportTableBody');
    if (!table) {
        showToast('Таблица не найдена!', 'error');
        return;
    }
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0 || (rows[0] && rows[0].textContent.includes('Нет данных'))) {
        showToast('Нет данных для печати. Нажмите "Сформировать".', 'warning');
        return;
    }
    exportToPDF('goodsReportTableBody', 'Отчёт_ТМЦ');
}

// ================================================================
//  ФУНКЦИИ ЭКСПОРТА
// ================================================================
function exportPDFcash() { 
    const table = document.getElementById('cashReportBody');
    if (!table) {
        showToast('Таблица не найдена!', 'error');
        return;
    }
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    if (rows[0] && rows[0].textContent.includes('Нет данных')) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    exportToPDF('cashReportBody', 'Кассовый_отчёт');
}

function exportExcelCash() { 
    const table = document.getElementById('cashReportBody');
    if (!table) {
        showToast('Таблица не найдена!', 'error');
        return;
    }
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    if (rows[0] && rows[0].textContent.includes('Нет данных')) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    exportToExcelTable('cashReportBody', 'Кассовый_отчёт');
}

function exportWordCash() { 
    const table = document.getElementById('cashReportBody');
    if (!table) {
        showToast('Таблица не найдена!', 'error');
        return;
    }
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    if (rows[0] && rows[0].textContent.includes('Нет данных')) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    exportToWord('cashReportBody', 'Кассовый_отчёт');
}

function printCashReport() { 
    const table = document.getElementById('cashReportBody');
    if (!table) {
        showToast('Таблица не найдена!', 'error');
        return;
    }
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) {
        showToast('Нет данных для печати', 'warning');
        return;
    }
    if (rows[0] && rows[0].textContent.includes('Нет данных')) {
        showToast('Нет данных для печати', 'warning');
        return;
    }
    exportToPDF('cashReportBody', 'Кассовый_отчёт');
}

function exportPDFmc42() { 
    const content = document.getElementById('mc42Result');
    if (!content) {
        showToast('Элемент не найден', 'error');
        return;
    }
    const startEl = document.getElementById('mc42Start');
    if (startEl && startEl.textContent === '0 ₽') {
        showToast('Сначала сформируйте справку!', 'warning');
        return;
    }
    exportToPDF('mc42Result', 'Справка_МС-42');
}

function exportPDF2ap() { 
    const table = document.getElementById('report2apTableBody');
    if (!table) {
        showToast('Таблица не найдена', 'error');
        return;
    }
    const tbody = table.querySelector('tbody');
    if (!tbody || tbody.rows.length === 0) {
        showToast('Нет данных для экспорта. Нажмите "Сформировать".', 'warning');
        return;
    }
    const firstRow = tbody.querySelector('tr');
    if (firstRow && firstRow.textContent.includes('Нет данных')) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    exportToPDF('report2apTableBody', 'Отчёт_ф2а-п');
}

function exportPDFgoods() { 
    const table = document.getElementById('goodsReportTableBody');
    if (!table) {
        showToast('Таблица не найдена', 'error');
        return;
    }
    const tbody = table.querySelector('tbody');
    if (!tbody || tbody.rows.length === 0) {
        showToast('Нет данных для экспорта. Нажмите "Сформировать".', 'warning');
        return;
    }
    const firstRow = tbody.querySelector('tr');
    if (firstRow && firstRow.textContent.includes('Нет данных')) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    exportToPDF('goodsReportTableBody', 'Отчёт_ТМЦ');
}

function printHistory() {
    const table = document.getElementById('historyModalBody');
    if (!table) {
        showToast('Таблица не найдена!', 'error');
        return;
    }
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0 || (rows[0] && rows[0].textContent.includes('Нет платежей'))) {
        showToast('Нет данных для печати', 'warning');
        return;
    }
    exportToPDF('historyModalBody', 'История_платежей');
}

function printDocument() {
    const table = document.getElementById('documentsBody');
    if (!table) {
        showToast('Таблица не найдена!', 'error');
        return;
    }
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0 || (rows[0] && rows[0].textContent.includes('Нет документов'))) {
        showToast('Нет документов для печати', 'warning');
        return;
    }
    exportToPDF('documentsBody', 'Документы');
}

function printJournal() {
    // Используем данные из appData.journal
    let data = appData.journal;
    if (!data || data.length === 0) {
        data = getJournalData();
        appData.journal = data;
    }
    
    if (!data || data.length === 0) {
        showToast('Нет данных для печати', 'warning');
        return;
    }
    
    const table = document.getElementById('journalBody');
    if (!table || table.querySelectorAll('tbody tr').length === 0) {
        showToast('Нет данных для печати', 'warning');
        return;
    }
    exportToPDF('journalBody', 'Журнал_операций');
}

// ================================================================
//  10. ОСТАЛЬНЫЕ ФУНКЦИИ (рендеринг таблиц)
// ================================================================

// --- Рендеринг товаров ---
function renderGoods() {
    const search = document.getElementById('goodsSearch')?.value?.toLowerCase() || '';
    let filtered = appData.products;
    if (goodsFilter !== 'all') {
        const map = { 'openki': 'Немаркированные открытки', 'calendars': 'Календари', 'konverty': 'Немаркированные конверты', 'upakovka': 'Упаковка', 'hoztovary': 'Хозяйственные товары', 'electronics': 'Электроника', 'food': 'Питание' };
        filtered = filtered.filter(p => p.category === map[goodsFilter]);
    }
    if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
    const tbody = document.getElementById('goodsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="8" style="text-align:center;padding:20px;color:var(--gray-500);">Нет товаров</td>`;
        tbody.appendChild(tr);
        return;
    }
    
    filtered.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.id}</td>
            <td><strong>${p.name}</strong></td>
            <td><span class="badge badge-info">${p.category}</span></td>
            <td>${p.qty}</td>
            <td>${p.price} ₽</td>
            <td>${p.total} ₽</td>
            <td><span class="badge ${p.status === 'В наличии' ? 'badge-success' : 'badge-danger'}">${p.status}</span></td>
            <td>
                <button class="btn btn-accent btn-xs" onclick="addToCart(${p.id})"><i class="fas fa-shopping-cart"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterGoods(filter) {
    goodsFilter = filter;
    document.querySelectorAll('.filter-buttons .filter-btn').forEach(b => b.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
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
        id: getNextId('products'),
        name: name,
        category: category,
        qty: qty,
        price: price,
        total: qty * price,
        status: 'В наличии'
    });
    appData.goodsStock.push({
        id: getNextId('goodsStock'),
        name: name,
        category: category,
        qty: qty,
        warehouse: 'Склад №1'
    });
    saveData();
    closeModal('productModal');
    renderAll();
    showToast('Товар добавлен!', 'success');
    return false;
}

// --- Рендеринг остатков ТМЦ ---
function renderGoodsStock() {
    const tbody = document.getElementById('goodsStockBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!appData.goodsStock || appData.goodsStock.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    
    let totalQty = 0;
    let totalValue = 0;
    
    appData.goodsStock.forEach(g => {
        totalQty += g.qty || 0;
        const product = appData.products.find(p => p.name === g.name);
        const price = product ? product.price : 0;
        const value = (g.qty || 0) * price;
        totalValue += value;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${g.id}</td>
            <td><strong>${g.name}</strong></td>
            <td><span class="badge badge-info">${g.category}</span></td>
            <td><strong>${g.qty}</strong></td>
            <td>${g.warehouse}</td>
            <td>${value.toLocaleString('ru-RU')} ₽</td>
        `;
        tbody.appendChild(tr);
    });
    
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

function refreshStock() {
    renderGoodsStock();
    showToast('Остатки обновлены!', 'success');
}

// --- Рендеринг прочих таблиц ---
function renderParcels() {
    const search = document.getElementById('parcelSearch')?.value?.toLowerCase() || '';
    let filtered = appData.parcels;
    if (search) filtered = filtered.filter(p => p.track.toLowerCase().includes(search) || p.sender.toLowerCase().includes(search));
    const tbody = document.getElementById('parcelsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="7" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    
    filtered.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.track}</strong></td>
            <td>${p.sender}</td>
            <td>${p.receiver}</td>
            <td>${p.type}</td>
            <td>${p.weight} кг</td>
            <td><span class="badge ${p.status === 'Вручено' ? 'badge-success' : p.status === 'Принято' ? 'badge-info' : 'badge-warning'}">${p.status}</span></td>
            <td>
                <button class="btn btn-success btn-xs" onclick="deliverParcel(${p.id})"><i class="fas fa-check"></i></button>
                <button class="btn btn-danger btn-xs" onclick="deleteItem('parcels', ${p.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function saveParcel(e) {
    e.preventDefault();
    const track = 'TRK-2026-' + String(appData.parcels.length + 1).padStart(3, '0');
    const price = calcParcelPrice();
    appData.parcels.push({
        id: getNextId('parcels'),
        track: track,
        sender: document.getElementById('pSender').value.trim(),
        receiver: document.getElementById('pReceiver').value.trim(),
        type: document.getElementById('pType').value,
        weight: parseFloat(document.getElementById('pWeight').value) || 0,
        status: 'Принято',
        price: price,
        date: new Date().toISOString().split('T')[0]
    });
    cart.push({
        id: 'parcel-' + Date.now(),
        name: 'Отправление: ' + track + ' (' + document.getElementById('pType').value + ')',
        category: 'Почтовые отправления',
        qty: 1,
        price: price,
        total: price,
        status: 'В корзине'
    });
    updateCartBadge();
    renderCart();
    saveData();
    closeModal('parcelModal');
    renderParcels();
    showToast('Отправление принято! Стоимость: ' + price.toFixed(2) + ' ₽', 'success');
    return false;
}

function deliverParcel(id) {
    const item = appData.parcels.find(p => p.id === id);
    if (item) {
        item.status = 'Вручено';
        appData.delivery.push({
            id: getNextId('delivery'),
            track: item.track,
            receiver: item.receiver,
            sender: item.sender,
            type: item.type,
            status: 'Вручено',
            date: new Date().toISOString().split('T')[0]
        });
        saveData();
        renderAll();
        showToast('Отправление вручено!', 'success');
    }
}

// --- Рендеринг РПО ---
function renderRPO() {
    const tbody = document.getElementById('rpoTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!appData.rpo || appData.rpo.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="8" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    
    appData.rpo.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${r.track}</strong></td>
            <td>${r.type}</td>
            <td>${r.sender}</td>
            <td>${r.receiver}</td>
            <td>${r.weight || 0} г</td>
            <td>${r.value || 0} ₽</td>
            <td>${r.price || 0} ₽</td>
            <td><span class="badge ${r.status === 'Вручено' ? 'badge-success' : r.status === 'Принято' ? 'badge-info' : 'badge-warning'}">${r.status}</span></td>
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
    if (!track || !sender || !receiver) { showToast('Заполните все поля!', 'error'); return false; }
    if (weight <= 0) { showToast('Введите корректный вес!', 'error'); return false; }
    cart.push({
        id: 'rpo-' + Date.now(),
        name: 'РПО: ' + type + ' (' + track + ')',
        category: 'Почтовые отправления',
        qty: 1,
        price: price,
        total: price,
        status: 'В корзине',
        track: track,
        type: type,
        sender: sender,
        receiver: receiver,
        weight: weight,
        value: value
    });
    updateCartBadge();
    renderCart();
    appData.rpo.push({
        id: getNextId('rpo'),
        track: track,
        type: type,
        sender: sender,
        receiver: receiver,
        weight: weight,
        value: value,
        price: price,
        status: 'В корзине'
    });
    saveData();
    closeModal('rpoModal');
    renderRPO();
    showToast('РПО добавлено в корзину! Стоимость: ' + price.toFixed(2) + ' ₽', 'success');
    return false;
}

// --- Услуги ---
function renderServices() {
    const tbody = document.getElementById('extraServicesBody');
    if (!tbody) return;
    tbody.innerHTML = appData.services.map(s => `
        <tr>
            <td>${s.id}</td>
            <td><strong>${s.name}</strong></td>
            <td>${s.price} ₽</td>
            <td>${s.desc || '—'}</td>
            <td>
                <button class="btn btn-accent btn-xs" onclick="addExtraServiceToCart(${s.id})"><i class="fas fa-shopping-cart"></i></button>
            </td>
        </tr>
    `).join('');
}

// --- Вручение ---
function renderDelivery() {
    const tbody = document.getElementById('deliveryBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.delivery || appData.delivery.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="7" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.delivery.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${d.track}</strong></td>
            <td>${d.receiver}</td>
            <td>${d.sender || '—'}</td>
            <td>${d.type}</td>
            <td><span class="badge ${d.status === 'Вручено' ? 'badge-success' : 'badge-warning'}">${d.status}</span></td>
            <td>${d.date}</td>
            <td><button class="btn btn-accent btn-xs" onclick="confirmDelivery(${d.id})"><i class="fas fa-check"></i></button></td>
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
    if (!track || !receiver || !sender) { showToast('Заполните обязательные поля!', 'error'); return false; }
    const parcel = appData.parcels.find(p => p.track === track);
    if (parcel) {
        parcel.status = 'Вручено';
        appData.delivery.push({
            id: getNextId('delivery'),
            track: track,
            receiver: receiver,
            sender: sender,
            type: parcel.type,
            status: 'Вручено',
            date: new Date().toISOString().split('T')[0],
            address: address,
            senderAddress: senderAddress
        });
        saveData();
        closeModal('deliveryModal');
        renderAll();
        showToast('Отправление вручено!', 'success');
    } else {
        showToast('Трек не найден!', 'error');
    }
    return false;
}

function confirmDelivery(id) {
    const item = appData.delivery.find(d => d.id === id);
    if (item) {
        item.status = 'Вручено';
        item.date = new Date().toISOString().split('T')[0];
        saveData();
        renderDelivery();
        showToast('Вручение подтверждено', 'success');
    }
}

// --- Возврат вручения ---
function renderDeliveryReturn() {
    const tbody = document.getElementById('deliveryReturnBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.deliveryReturn || appData.deliveryReturn.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="7" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.deliveryReturn.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${d.track}</strong></td>
            <td>${d.sender}</td>
            <td>${d.receiver}</td>
            <td>${d.senderAddress || '—'}</td>
            <td>${d.receiverAddress || '—'}</td>
            <td>${d.date}</td>
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
    if (!track || !sender || !receiver) { showToast('Заполните обязательные поля!', 'error'); return false; }
    appData.deliveryReturn.push({
        id: getNextId('deliveryReturn'),
        track: track,
        sender: sender,
        receiver: receiver,
        senderAddress: senderAddress || '—',
        receiverAddress: receiverAddress || '—',
        date: new Date().toISOString().split('T')[0],
        status: 'В обработке',
        reason: reason
    });
    saveData();
    closeModal('deliveryReturnModal');
    renderDeliveryReturn();
    showToast('Возврат оформлен!', 'success');
    return false;
}

// --- Лотереи ---
function renderLottery() {
    const tbody = document.getElementById('lotteryBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.lottery || appData.lottery.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.lottery.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${l.ticket}</td>
            <td>${l.client}</td>
            <td>${l.amount} ₽</td>
            <td>${l.date}</td>
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
            client: client,
            amount: price,
            date: date,
            status: 'Принят'
        });
    }
    saveData();
    closeModal('lotterySaleModal');
    renderLottery();
    showToast('Билеты проданы!', 'success');
    return false;
}

function saveLotteryPay(e) {
    e.preventDefault();
    const client = document.getElementById('lpClient').value.trim();
    const ticket = document.getElementById('lpTicket').value.trim();
    const amount = parseFloat(document.getElementById('lpAmount').value) || 0;
    if (!client || !ticket) { showToast('Заполните все поля!', 'error'); return false; }
    const item = appData.lottery.find(l => l.ticket === ticket);
    if (item) {
        item.status = 'Выигрыш';
        item.amount = amount;
    } else {
        appData.lottery.push({
            id: getNextId('lottery'),
            ticket: ticket,
            client: client,
            amount: amount,
            date: new Date().toISOString().split('T')[0],
            status: 'Выигрыш'
        });
    }
    saveData();
    closeModal('lotteryPayModal');
    renderLottery();
    showToast('Выплата произведена!', 'success');
    return false;
}

function generateLotteryReport() {
    const total = appData.lottery.reduce((s, l) => s + l.amount, 0);
    const wins = appData.lottery.filter(l => l.status === 'Выигрыш').length;
    document.getElementById('lotteryReport').innerHTML = `
        <div style="background:var(--success-light);padding:16px;border-radius:var(--radius-sm);color:#1a7a3a;margin-bottom:12px;">
            <i class="fas fa-chart-bar"></i> <strong>Отчёт по лотереям:</strong>
            <ul style="margin-top:8px;list-style:none;">
                <li>✅ Всего билетов: ${appData.lottery.length}</li>
                <li>💰 Выручка: ${total} ₽</li>
                <li>🏆 Выигрышей: ${wins}</li>
            </ul>
        </div>
    `;
    showToast('Отчёт по лотереям сформирован', 'success');
}

// --- Страховка ---
function renderInsurance() {
    const tbody = document.getElementById('insuranceBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.insurance || appData.insurance.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="7" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.insurance.forEach(i => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i.policy}</td>
            <td>${i.client}</td>
            <td>${i.passportSeries || '—'} ${i.passportNumber || '—'}</td>
            <td>${i.birthdate || '—'}</td>
            <td>${i.amount} ₽</td>
            <td>${i.date}</td>
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
    if (!client || !passportSeries || !passportNumber) { showToast('Заполните обязательные поля!', 'error'); return false; }
    appData.insurance.push({
        id: getNextId('insurance'),
        policy: 'INS-' + String(appData.insurance.length + 1).padStart(3, '0'),
        client: client,
        passportSeries: passportSeries,
        passportNumber: passportNumber,
        birthdate: birthdate || '—',
        amount: amount,
        type: type,
        date: new Date().toISOString().split('T')[0],
        status: 'Активен'
    });
    saveData();
    closeModal('insuranceModal');
    renderInsurance();
    showToast('Страховка оформлена!', 'success');
    return false;
}

// --- SIM-карты ---
function renderSIM() {
    const tbody = document.getElementById('simBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.sim || appData.sim.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.sim.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.sim}</td>
            <td>${s.phone}</td>
            <td>${s.operator}</td>
            <td>${s.tariff}</td>
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
    if (!operator || !phone || !owner) { showToast('Заполните все поля!', 'error'); return false; }
    appData.sim.push({
        id: getNextId('sim'),
        sim: 'SIM-' + String(appData.sim.length + 1).padStart(3, '0'),
        phone: phone,
        operator: operator,
        owner: owner,
        tariff: tariff,
        status: 'Активна'
    });
    appData.products.push({
        id: getNextId('products'),
        name: 'SIM-карта ' + operator,
        category: 'Электроника',
        qty: 1,
        price: 250,
        total: 250,
        status: 'В наличии'
    });
    saveData();
    closeModal('simModal');
    renderAll();
    showToast('SIM-карта активирована!', 'success');
    return false;
}

// --- Цифровые сервисы ---
function renderDigital() {
    const tbody = document.getElementById('digitalBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.digital || appData.digital.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.digital.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${d.service}</strong></td>
            <td>${d.client}</td>
            <td>${d.price} ₽</td>
            <td>${d.date}</td>
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
    if (!client || !service) { showToast('Заполните все поля!', 'error'); return false; }
    appData.digital.push({
        id: getNextId('digital'),
        client: client,
        service: service,
        price: price,
        date: new Date().toISOString().split('T')[0],
        status: 'Активна'
    });
    saveData();
    closeModal('digitalModal');
    renderDigital();
    showToast('Сервис подключён!', 'success');
    return false;
}

// --- Телеграммы ---
function renderTelegram() {
    const tbody = document.getElementById('telegramBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.telegram || appData.telegram.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="10" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.telegram.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${t.id}</td>
            <td>${t.sender}</td>
            <td>${t.senderAddress || '—'}</td>
            <td>${t.receiver}</td>
            <td>${t.receiverAddress || '—'}</td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.text || '—'}</td>
            <td>${t.words || 0}</td>
            <td>${t.price || 0} ₽</td>
            <td>${t.date}</td>
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
        showToast('Заполните все поля!', 'error'); 
        return false; 
    }
    appData.telegram.push({
        id: getNextId('telegram'),
        sender: sender,
        senderAddress: senderAddress,
        receiver: receiver,
        receiverAddress: receiverAddress,
        text: text,
        words: words,
        price: price,
        date: new Date().toISOString().split('T')[0],
        status: 'Отправлена'
    });
    saveData();
    closeModal('telegramModal');
    renderTelegram();
    showToast('Телеграмма отправлена! Стоимость: ' + price + ' ₽', 'success');
    return false;
}

// --- Ксерокопии ---
function renderCopy() {
    const tbody = document.getElementById('copyBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.copy || appData.copy.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.copy.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.id}</td>
            <td>${c.client}</td>
            <td>${c.type}</td>
            <td>${c.qty}</td>
            <td>${c.price} ₽</td>
            <td>${c.date}</td>
        `;
        tbody.appendChild(tr);
    });
}

function saveCopy(e) {
    e.preventDefault();
    const client = document.getElementById('copyClient').value.trim();
    const type = document.getElementById('copyType').value;
    const qty = parseInt(document.getElementById('copyQty').value) || 1;
    const price = parseFloat(document.getElementById('copyPrice').value) || 10;
    if (!client) { showToast('Введите клиента!', 'error'); return false; }
    appData.copy.push({
        id: getNextId('copy'),
        client: client,
        type: type,
        qty: qty,
        price: qty * price,
        date: new Date().toISOString().split('T')[0]
    });
    saveData();
    closeModal('copyModal');
    renderCopy();
    showToast('Копия создана!', 'success');
    return false;
}

// --- Пенсии ---
function renderPension() {
    const tbody = document.getElementById('pensionBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.pension || appData.pension.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="7" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.pension.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.id}</td>
            <td>${p.name}</td>
            <td>${p.snils}</td>
            <td>${p.amount} ₽</td>
            <td>${p.type}</td>
            <td>${p.date}</td>
            <td><span class="badge ${p.status === 'Выплачено' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function savePension(e) {
    e.preventDefault();
    const name = document.getElementById('pensName').value.trim();
    const snils = document.getElementById('pensSnils').value.trim();
    const address = document.getElementById('pensAddress').value.trim();
    const amount = parseFloat(document.getElementById('pensAmount').value) || 0;
    const type = document.getElementById('pensType').value;
    if (!name || !snils || !address) { showToast('Заполните все поля!', 'error'); return false; }
    appData.pension.push({
        id: getNextId('pension'),
        name: name,
        snils: snils,
        address: address,
        amount: amount,
        type: type,
        date: new Date().toISOString().split('T')[0],
        status: 'Назначено'
    });
    saveData();
    closeModal('pensionModal');
    renderPension();
    showToast('Выплата назначена!', 'success');
    return false;
}

// --- Система Город ---
function renderCityPayments() {
    const tbody = document.getElementById('cityPaymentsBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.cityPayments || appData.cityPayments.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.cityPayments.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.id}</td>
            <td>${p.payer}</td>
            <td>${p.service}</td>
            <td>${p.amount} ₽</td>
            <td>${p.date}</td>
            <td><span class="badge ${p.status === 'Оплачено' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Быстрые платежи ---
function savePhonePayment(e) {
    e.preventDefault();
    const phone = document.getElementById('phoneNumber').value.trim();
    const amount = parseFloat(document.getElementById('phoneAmount').value) || 0;
    const operator = document.getElementById('phoneOperator').value;
    if (!phone || !amount) { showToast('Заполните все поля!', 'error'); return false; }
    appData.cityPayments.push({
        id: getNextId('cityPayments'),
        payer: phone,
        service: 'Телефон (' + operator + ')',
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        status: 'Оплачено'
    });
    saveData();
    closeModal('paymentPhoneModal');
    renderCityPayments();
    showToast('Оплата телефона выполнена!', 'success');
    return false;
}

function saveTrashPayment(e) {
    e.preventDefault();
    const account = document.getElementById('trashAccount').value.trim();
    const amount = parseFloat(document.getElementById('trashAmount').value) || 0;
    if (!account || !amount) { showToast('Заполните все поля!', 'error'); return false; }
    appData.cityPayments.push({
        id: getNextId('cityPayments'),
        payer: account,
        service: 'Мусор',
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        status: 'Оплачено'
    });
    saveData();
    closeModal('paymentTrashModal');
    renderCityPayments();
    showToast('Оплата за мусор выполнена!', 'success');
    return false;
}

function saveFinePayment(e) {
    e.preventDefault();
    const number = document.getElementById('fineNumber').value.trim();
    const amount = parseFloat(document.getElementById('fineAmount').value) || 0;
    const type = document.getElementById('fineType').value;
    if (!number || !amount) { showToast('Заполните все поля!', 'error'); return false; }
    appData.cityPayments.push({
        id: getNextId('cityPayments'),
        payer: number,
        service: 'Штраф (' + type + ')',
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        status: 'Оплачено'
    });
    saveData();
    closeModal('paymentFineModal');
    renderCityPayments();
    showToast('Оплата штрафа выполнена!', 'success');
    return false;
}

function saveTaxPayment(e) {
    e.preventDefault();
    const inn = document.getElementById('taxInn').value.trim();
    const type = document.getElementById('taxType').value;
    const amount = parseFloat(document.getElementById('taxAmount').value) || 0;
    const period = document.getElementById('taxPeriod').value;
    if (!inn || !amount) { showToast('Заполните все поля!', 'error'); return false; }
    appData.cityPayments.push({
        id: getNextId('cityPayments'),
        payer: inn,
        service: 'Налог (' + type + ') - ' + period,
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        status: 'Оплачено'
    });
    saveData();
    closeModal('paymentTaxModal');
    renderCityPayments();
    showToast('Оплата налога выполнена!', 'success');
    return false;
}

// --- Операции с картой ---
function checkBalance() {
    const card = document.getElementById('balanceCard').value.trim();
    const result = document.getElementById('balanceResult');
    if (!card || card.length < 16) {
        result.style.display = 'block';
        result.className = 'result-box error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> Введите корректный номер карты (16 цифр)';
        return;
    }
    const balance = Math.floor(Math.random() * 50000) + 1000;
    result.style.display = 'block';
    result.className = 'result-box success';
    result.innerHTML = `<i class="fas fa-check-circle"></i> <strong>Баланс карты: ${balance.toLocaleString('ru-RU')} ₽</strong>`;
    showToast('Баланс успешно получен!', 'success');
}

function processWithdraw() {
    const card = document.getElementById('withdrawCard').value.trim();
    const amount = document.getElementById('withdrawAmount').value;
    const name = document.getElementById('withdrawName').value.trim();
    const passport = document.getElementById('withdrawPassport').value.trim();
    const result = document.getElementById('withdrawResult');
    if (!card || card.length < 16) {
        result.style.display = 'block';
        result.className = 'result-box error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> Введите корректный номер карты';
        return;
    }
    if (!amount || parseInt(amount) <= 0) {
        result.style.display = 'block';
        result.className = 'result-box error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> Введите сумму снятия';
        return;
    }
    result.style.display = 'block';
    result.className = 'result-box success';
    result.innerHTML = `<i class="fas fa-check-circle"></i> <strong>Снятие наличных выполнено!</strong><div style="font-size:14px;font-weight:400;margin-top:4px;">Сумма: ${parseInt(amount).toLocaleString('ru-RU')} ₽ · Получатель: ${name}</div>`;
    appData.withdrawHistory.push({
        id: getNextId('withdrawHistory'),
        client: name || 'Клиент',
        amount: parseInt(amount),
        date: new Date().toISOString().split('T')[0],
        status: 'Выполнено'
    });
    saveData();
    renderWithdrawHistory();
    showToast('Снятие наличных выполнено!', 'success');
}

function processDeposit() {
    const card = document.getElementById('depositCard').value.trim();
    const amount = document.getElementById('depositAmount').value;
    const name = document.getElementById('depositName').value.trim();
    const method = document.getElementById('depositMethod').value;
    const result = document.getElementById('depositResult');
    if (!card || card.length < 16) {
        result.style.display = 'block';
        result.className = 'result-box error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> Введите корректный номер карты';
        return;
    }
    if (!amount || parseInt(amount) <= 0) {
        result.style.display = 'block';
        result.className = 'result-box error';
        result.innerHTML = '<i class="fas fa-exclamation-circle"></i> Введите сумму зачисления';
        return;
    }
    result.style.display = 'block';
    result.className = 'result-box success';
    result.innerHTML = `<i class="fas fa-check-circle"></i> <strong>Зачисление наличных выполнено!</strong><div style="font-size:14px;font-weight:400;margin-top:4px;">Сумма: ${parseInt(amount).toLocaleString('ru-RU')} ₽ · Способ: ${method}</div>`;
    appData.depositHistory.push({
        id: getNextId('depositHistory'),
        client: name || 'Клиент',
        amount: parseInt(amount),
        date: new Date().toISOString().split('T')[0],
        status: 'Зачислено'
    });
    saveData();
    renderDepositHistory();
    showToast('Зачисление наличных выполнено!', 'success');
}

function renderWithdrawHistory() {
    const tbody = document.getElementById('withdrawHistoryBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.withdrawHistory || appData.withdrawHistory.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.withdrawHistory.forEach(w => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${w.id}</td>
            <td>${w.client}</td>
            <td>${w.amount} ₽</td>
            <td>${w.date}</td>
            <td><span class="badge badge-success">${w.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderDepositHistory() {
    const tbody = document.getElementById('depositHistoryBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.depositHistory || appData.depositHistory.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.depositHistory.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${d.id}</td>
            <td>${d.client}</td>
            <td>${d.amount} ₽</td>
            <td>${d.date}</td>
            <td><span class="badge badge-success">${d.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// --- БЭК-ЗОНА ---
function renderIncoming() {
    const tbody = document.getElementById('incomingBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.incoming || appData.incoming.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.incoming.forEach(i => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${i.track}</strong></td>
            <td>${i.sender}</td>
            <td>${i.date}</td>
            <td>${i.type}</td>
            <td><span class="badge badge-info">${i.status}</span></td>
            <td><button class="btn btn-success btn-xs" onclick="showToast('Обработано', 'success')"><i class="fas fa-check"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

function saveIncoming(e) {
    e.preventDefault();
    const track = document.getElementById('incTrack').value.trim();
    const sender = document.getElementById('incSender').value.trim();
    const type = document.getElementById('incType').value;
    if (!track || !sender) { showToast('Заполните все поля!', 'error'); return false; }
    appData.incoming.push({
        id: getNextId('incoming'),
        track: track,
        sender: sender,
        date: new Date().toISOString().split('T')[0],
        type: type,
        status: 'Принято'
    });
    saveData();
    closeModal('incomingModal');
    renderIncoming();
    showToast('Входящая почта зафиксирована!', 'success');
    return false;
}

function renderDocuments() {
    const tbody = document.getElementById('documentsBody');
    if (!tbody) return;
    
    // Очищаем tbody
    tbody.innerHTML = '';
    
    if (!appData.documents || appData.documents.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет документов</td>`;
        tbody.appendChild(tr);
        return;
    }
    
    appData.documents.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${d.number}</td>
            <td>${d.type}</td>
            <td>${d.sender}</td>
            <td>${d.date}</td>
            <td>
                <button class="btn btn-info btn-xs" onclick="openDocument(${d.id})"><i class="fas fa-eye"></i> Открыть</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openDocument(id) {
    const doc = appData.documents.find(d => d.id === id);
    if (doc) {
        showToast('📄 Документ "' + doc.number + '" открыт', 'info');
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-window">
                <h3><i class="fas fa-file-alt" style="color:var(--info);"></i> Просмотр документа</h3>
                <p><strong>Номер:</strong> ${doc.number}</p>
                <p><strong>Тип:</strong> ${doc.type}</p>
                <p><strong>Отправитель:</strong> ${doc.sender}</p>
                <p><strong>Дата:</strong> ${doc.date}</p>
                <div style="margin-top:16px;padding:16px;background:var(--gray-50);border-radius:var(--radius-sm);">
                    <p style="color:var(--gray-500);">Содержимое документа...</p>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

function searchDocuments() {
    const from = document.getElementById('docSearchFrom').value;
    const to = document.getElementById('docSearchTo').value;
    const number = document.getElementById('docSearchNumber').value.toLowerCase().trim();
    let filtered = appData.documents;
    if (from) filtered = filtered.filter(d => d.date >= from);
    if (to) filtered = filtered.filter(d => d.date <= to);
    if (number) filtered = filtered.filter(d => d.number.toLowerCase().includes(number));
    const tbody = document.getElementById('documentsBody');
    if (!tbody) return;
    tbody.innerHTML = filtered.map(d => `
        <tr>
            <td>${d.number}</td>
            <td>${d.type}</td>
            <td>${d.sender}</td>
            <td>${d.date}</td>
            <td>
                <button class="btn btn-accent btn-xs" onclick="printDocument()"><i class="fas fa-print"></i></button>
                <button class="btn btn-info btn-xs" onclick="openDocument(${d.id})"><i class="fas fa-eye"></i></button>
            </td>
        </tr>
    `).join('');
    showToast('Найдено документов: ' + filtered.length, 'info');
}

// --- Емкости ---
function renderCapacity() {
    const grid = document.getElementById('capacityGrid');
    if (grid) {
        grid.innerHTML = appData.capacity.map(c => `
            <div class="capacity-item" onclick="showToast('${c.name} открыта', 'info')">
                <i class="fas fa-box"></i>
                <h4>${c.name}</h4>
                <p>${c.items || '0 отправлений'} · ${c.weight} кг</p>
                <span class="badge ${c.status === 'Готова' ? 'badge-success' : 'badge-warning'}">${c.status}</span>
            </div>
        `).join('');
    }
    const tbody = document.getElementById('capacityTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.capacity || appData.capacity.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.capacity.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.name}</strong></td>
            <td>${c.items || '—'}</td>
            <td>${c.weight} кг</td>
            <td><span class="badge ${c.status === 'Готова' ? 'badge-success' : 'badge-warning'}">${c.status}</span></td>
            <td>
                <button class="btn btn-primary btn-xs" onclick="openModal('capacityEditModal')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-xs" onclick="deleteCapacity(${c.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function saveCapacity(e) {
    e.preventDefault();
    const name = document.getElementById('capName').value.trim();
    const weight = parseFloat(document.getElementById('capWeight').value) || 0;
    const parcels = document.getElementById('capParcels');
    const selected = [];
    for (let opt of parcels.options) {
        if (opt.selected) selected.push(opt.value);
    }
    if (!name) { showToast('Введите название емкости!', 'error'); return false; }
    appData.capacity.push({
        id: getNextId('capacity'),
        name: name,
        items: selected.join(', ') || 'Новые отправления',
        weight: weight,
        status: 'В процессе'
    });
    saveData();
    closeModal('capacityModal');
    renderCapacity();
    showToast('Емкость создана!', 'success');
    return false;
}

function fillCapacityEditSelect() {
    const select = document.getElementById('capEditSelect');
    if (!select) return;
    select.innerHTML = appData.capacity.map(c => `
        <option value="${c.id}">${c.name} (${c.status})</option>
    `).join('');
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
    showToast('Емкость обновлена!', 'success');
    return false;
}

function deleteCapacity(id) {
    if (!confirm('Удалить емкость?')) return;
    appData.capacity = appData.capacity.filter(c => c.id !== id);
    saveData();
    renderCapacity();
    showToast('Емкость удалена', 'info');
}

// --- Накладные ---
function renderInvoice() {
    const tbody = document.getElementById('invoiceTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.invoice || appData.invoice.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.invoice.forEach(i => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${i.number}</strong></td>
            <td>${i.type}</td>
            <td>${i.creator}</td>
            <td>${i.date}</td>
            <td><span class="badge ${i.status === 'Готово' ? 'badge-success' : 'badge-warning'}">${i.status}</span></td>
            <td><button class="btn btn-info btn-xs" onclick="viewInvoice(${i.id})"><i class="fas fa-eye"></i> Просмотр</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function viewInvoice(id) {
    const inv = appData.invoice.find(i => i.id === id);
    if (inv) {
        showToast('📄 Накладная "' + inv.number + '" открыта', 'info');
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-window">
                <h3><i class="fas fa-file-invoice" style="color:var(--accent);"></i> Накладная</h3>
                <p><strong>Номер:</strong> ${inv.number}</p>
                <p><strong>Тип:</strong> ${inv.type}</p>
                <p><strong>Создал:</strong> ${inv.creator}</p>
                <p><strong>Дата:</strong> ${inv.date}</p>
                <p><strong>Статус:</strong> <span class="badge ${inv.status === 'Готово' ? 'badge-success' : 'badge-warning'}">${inv.status}</span></p>
                <div class="modal-actions">
                    <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

function saveInvoice(type) {
    const numInput = type === 'Ф23' ? 'invNumber' : 'invNumberA';
    const senderInput = type === 'Ф23' ? 'invSender' : 'invSenderA';
    const receiverInput = type === 'Ф23' ? 'invReceiver' : 'invReceiverA';
    const number = document.getElementById(numInput).value.trim();
    const sender = document.getElementById(senderInput).value.trim();
    const receiver = document.getElementById(receiverInput).value.trim();
    if (!number || !sender || !receiver) {
        showToast('Заполните все поля!', 'error');
        return false;
    }
    appData.invoice.push({
        id: getNextId('invoice'),
        number: number,
        type: type,
        creator: 'Сотрудник',
        date: new Date().toISOString().split('T')[0],
        status: 'В обработке'
    });
    saveData();
    const modalId = type === 'Ф23' ? 'invoiceF23Modal' : 'invoiceF23aModal';
    closeModal(modalId);
    renderInvoice();
    showToast('Накладная ' + number + ' создана!', 'success');
    return false;
}

// --- Водитель ---
function renderDriver() {
    const tbody = document.getElementById('driverTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.driver || appData.driver.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.driver.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${d.driver}</strong></td>
            <td>${d.transport}</td>
            <td>${d.capacities}</td>
            <td>${d.invoices}</td>
            <td><span class="badge ${d.status === 'Передано' ? 'badge-success' : 'badge-warning'}">${d.status}</span></td>
            <td><button class="btn btn-info btn-xs" onclick="viewDriverDetails(${d.id})"><i class="fas fa-route"></i> Маршрут</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function viewDriverDetails(id) {
    const driver = appData.driver.find(d => d.id === id);
    if (driver) {
        showToast('🚚 Маршрутный лист водителя ' + driver.driver, 'info');
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-window">
                <h3><i class="fas fa-route" style="color:var(--accent);"></i> Маршрутный лист</h3>
                <p><strong>Водитель:</strong> ${driver.driver}</p>
                <p><strong>Транспорт:</strong> ${driver.transport}</p>
                <p><strong>Емкостей:</strong> ${driver.capacities}</p>
                <p><strong>Накладные:</strong> ${driver.invoices}</p>
                <p><strong>Статус:</strong> <span class="badge ${driver.status === 'Передано' ? 'badge-success' : 'badge-warning'}">${driver.status}</span></p>
                <div class="modal-actions">
                    <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

function fillDriverTransferSelects() {
    const capSelect = document.getElementById('dtCapacities');
    const invSelect = document.getElementById('dtInvoices');
    if (capSelect) {
        capSelect.innerHTML = appData.capacity.map(c => `
            <option value="${c.name}">${c.name} (${c.status})</option>
        `).join('');
    }
    if (invSelect) {
        invSelect.innerHTML = appData.invoice.map(i => `
            <option value="${i.number}">${i.number} (${i.type})</option>
        `).join('');
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
    if (!driver || !transport) { showToast('Заполните все поля!', 'error'); return false; }
    appData.driver.push({
        id: getNextId('driver'),
        driver: driver,
        transport: transport,
        capacities: capacities.length || '—',
        invoices: invoices.join(', ') || '—',
        status: 'Передано'
    });
    appData.capacity.forEach(c => {
        if (capacities.includes(c.name)) c.status = 'Отправлена';
    });
    saveData();
    closeModal('driverTransferModal');
    renderAll();
    showToast('Почта передана водителю!', 'success');
    return false;
}

// --- Задания почтальона ---
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
                    <div class="task-name">${t.name} — ${t.route}</div>
                    <div class="task-desc">${t.count} отправлений · ${t.addresses || 'адреса не указаны'}</div>
                    ${t.notes ? `<div class="task-desc">📝 ${t.notes}</div>` : ''}
                </div>
            </div>
            <div class="task-status">
                <span class="badge ${t.status === 'Выполняется' ? 'badge-success' : t.status === 'Ожидает' ? 'badge-warning' : 'badge-info'}">${t.status}</span>
                <button class="btn btn-primary btn-xs" onclick="viewTaskDetails(${t.id})"><i class="fas fa-route"></i> Маршрут</button>
            </div>
        </div>
    `).join('');
}

function viewTaskDetails(id) {
    const task = appData.postmanTasks.find(t => t.id === id);
    if (task) {
        showToast('📋 Детали задания для ' + task.name, 'info');
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-window">
                <h3><i class="fas fa-walking" style="color:var(--success);"></i> Задание почтальона</h3>
                <p><strong>Почтальон:</strong> ${task.name}</p>
                <p><strong>Маршрут:</strong> ${task.route}</p>
                <p><strong>Отправлений:</strong> ${task.count}</p>
                <p><strong>Адреса:</strong> ${task.addresses || 'не указаны'}</p>
                ${task.notes ? `<p><strong>Указания:</strong> ${task.notes}</p>` : ''}
                <p><strong>Статус:</strong> <span class="badge ${task.status === 'Выполняется' ? 'badge-success' : task.status === 'Ожидает' ? 'badge-warning' : 'badge-info'}">${task.status}</span></p>
                <div class="modal-actions">
                    <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

function savePostmanTask(e) {
    e.preventDefault();
    const name = document.getElementById('ptName').value.trim();
    const route = document.getElementById('ptRoute').value.trim();
    const count = parseInt(document.getElementById('ptCount').value) || 0;
    const addresses = document.getElementById('ptAddresses').value.trim();
    const notes = document.getElementById('ptNotes').value.trim();
    if (!name || !route) { showToast('Заполните все поля!', 'error'); return false; }
    appData.postmanTasks.push({
        id: getNextId('postmanTasks'),
        name: name,
        route: route,
        count: count,
        addresses: addresses || 'адреса не указаны',
        notes: notes || '',
        status: 'Запланировано'
    });
    saveData();
    closeModal('postmanTaskModal');
    renderPostmanTasks();
    showToast('Задание создано!', 'success');
    return false;
}

// --- Журнал РПО ---
function renderStorageJournal() {
    const tbody = document.getElementById('storageJournalBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.storageJournal || appData.storageJournal.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.storageJournal.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${s.track}</strong></td>
            <td>${s.receiver}</td>
            <td>${s.sender}</td>
            <td>${s.date}</td>
            <td><span class="badge ${s.status === 'Вручено' ? 'badge-success' : s.status === 'Задерживается' ? 'badge-danger' : 'badge-warning'}">${s.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function searchParcel() {
    const track = document.getElementById('searchTrack').value.trim();
    const person = document.getElementById('searchPerson').value.trim();
    const resultDiv = document.getElementById('searchResult');
    let found = appData.storageJournal.find(s => 
        s.track.toLowerCase().includes(track.toLowerCase()) ||
        s.receiver.toLowerCase().includes(person.toLowerCase()) ||
        s.sender.toLowerCase().includes(person.toLowerCase())
    );
    if (!found && track) {
        found = appData.parcels.find(p => p.track === track);
    }
    resultDiv.classList.add('active');
    if (found) {
        resultDiv.innerHTML = `
            <div class="found"><i class="fas fa-check-circle"></i> <strong>Отправление найдено!</strong></div>
            <div style="margin-top:8px;font-size:14px;">
                <p><strong>Трек:</strong> ${found.track}</p>
                <p><strong>Получатель:</strong> ${found.receiver || '—'}</p>
                <p><strong>Отправитель:</strong> ${found.sender || '—'}</p>
                <p><strong>Статус:</strong> <span class="badge ${found.status === 'Вручено' ? 'badge-success' : 'badge-warning'}">${found.status || 'Неизвестен'}</span></p>
            </div>
        `;
        showToast('Отправление найдено!', 'success');
    } else {
        resultDiv.innerHTML = `
            <div class="not-found"><i class="fas fa-exclamation-circle"></i> <strong>Отправление не найдено</strong></div>
            <div style="margin-top:8px;font-size:13px;color:var(--gray-500);">Проверьте правильность введённых данных.</div>
        `;
        showToast('Отправление не найдено', 'error');
    }
}

function printSearchReport() {
    const result = document.getElementById('searchResult');
    if (result && result.classList.contains('active')) {
        exportToPDF('searchResult', 'Отчёт_по_поиску');
    } else {
        showToast('Сначала найдите отправление!', 'warning');
    }
}

// --- Адресное хранение ---
function renderAddressStorage() {
    const tbody = document.getElementById('addressStorageBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.addressStorage || appData.addressStorage.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.addressStorage.forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${a.cell}</strong></td>
            <td>${a.track}</td>
            <td>${a.receiver}</td>
            <td>${a.term}</td>
            <td><span class="badge badge-info">${a.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
    const zones = { 'A': 0, 'B': 0, 'C': 0, 'D': 0 };
    appData.addressStorage.forEach(a => {
        const letter = a.cell.charAt(0).toUpperCase();
        if (zones[letter] !== undefined) zones[letter]++;
    });
    document.getElementById('zoneA').textContent = zones.A;
    document.getElementById('zoneB').textContent = zones.B;
    document.getElementById('zoneC').textContent = zones.C;
    document.getElementById('zoneD').textContent = zones.D;
}

// --- Возврат/Досыл ---
function renderReturnForward() {
    const tbody = document.getElementById('returnForwardBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.returnForward || appData.returnForward.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.returnForward.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${r.track}</strong></td>
            <td>${r.sender}</td>
            <td>${r.receiver || '—'}</td>
            <td><span class="badge ${r.operation === 'Возврат' ? 'badge-warning' : 'badge-info'}">${r.operation}</span></td>
            <td><button class="btn btn-success btn-xs" onclick="showToast('Оформлено', 'success')"><i class="fas fa-check"></i></button></td>
        `;
        tbody.appendChild(tr);
    });
}

function saveReturn(e) {
    e.preventDefault();
    const track = document.getElementById('retTrack').value.trim();
    const reason = document.getElementById('retReason').value.trim();
    const newAddress = document.getElementById('retNewAddress').value.trim();
    if (!track) { showToast('Введите трек-номер!', 'error'); return false; }
    appData.returnForward.push({
        id: getNextId('returnForward'),
        track: track,
        sender: 'Неизвестно',
        receiver: newAddress || '—',
        operation: 'Возврат' + (reason ? ' (' + reason + ')' : '')
    });
    saveData();
    closeModal('returnModal');
    renderReturnForward();
    showToast('Отправление направлено на возврат', 'success');
    return false;
}

function saveForward(e) {
    e.preventDefault();
    const track = document.getElementById('fwdTrack').value.trim();
    const receiver = document.getElementById('fwdReceiver').value.trim();
    const address = document.getElementById('fwdAddress').value.trim();
    const reason = document.getElementById('fwdReason').value.trim();
    if (!track || !receiver || !address) { showToast('Заполните все поля!', 'error'); return false; }
    appData.returnForward.push({
        id: getNextId('returnForward'),
        track: track,
        sender: 'Неизвестно',
        receiver: receiver + ' (' + address + ')',
        operation: 'Досыл' + (reason ? ' (' + reason + ')' : '')
    });
    saveData();
    closeModal('forwardModal');
    renderReturnForward();
    showToast('Отправление направлено на досыл', 'success');
    return false;
}

// --- Отчёты ---
function updateReportStats() {
    const cash1 = appData.cashReport.reduce((s, c) => s + c.income, 0);
    const cash2 = appData.cashReport.reduce((s, c) => s + c.outcome, 0);
    document.getElementById('cash1').textContent = cash1.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('cash2').textContent = cash2.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('cashTotal').textContent = (cash1 + cash2).toLocaleString('ru-RU') + ' ₽';
    document.getElementById('cashOperations').textContent = appData.cashReport.length;
    document.getElementById('mc42Start').textContent = cash2.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('mc42Income').textContent = cash1.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('mc42End').textContent = (cash1 + cash2).toLocaleString('ru-RU') + ' ₽';
    document.getElementById('mc42DateDisplay').textContent = document.getElementById('mc42Date')?.value || new Date().toISOString().split('T')[0];
    const letters = appData.report2ap.filter(r => r.type === 'Письма');
    const newspapers = appData.report2ap.filter(r => r.type === 'Газеты');
    const parcels = appData.report2ap.filter(r => r.type === 'Посылки');
    document.getElementById('report2apInLetters').textContent = letters.reduce((s, r) => s + r.incoming, 0);
    document.getElementById('report2apOutLetters').textContent = letters.reduce((s, r) => s + r.outgoing, 0);
    document.getElementById('report2apInNewspapers').textContent = newspapers.reduce((s, r) => s + r.incoming, 0);
    document.getElementById('report2apOutNewspapers').textContent = newspapers.reduce((s, r) => s + r.outgoing, 0);
    document.getElementById('report2apInParcels').textContent = parcels.reduce((s, r) => s + r.incoming, 0);
    document.getElementById('report2apOutParcels').textContent = parcels.reduce((s, r) => s + r.outgoing, 0);
    generateGoodsReportData();
    renderGoodsReport();
    const goodsTotal = appData.goodsReport.reduce((s, g) => s + g.income, 0);
    const goodsOut = appData.goodsReport.reduce((s, g) => s + g.outcome, 0);
    const goodsBal = appData.goodsReport.reduce((s, g) => s + g.balance, 0);
    const startBalanceEl = document.getElementById('goodsStartBalance');
    const incomeEl = document.getElementById('goodsIncome');
    const outcomeEl = document.getElementById('goodsOutcome');
    const endBalanceEl = document.getElementById('goodsEndBalance');
    if (startBalanceEl) startBalanceEl.textContent = goodsTotal + ' шт.';
    if (incomeEl) incomeEl.textContent = goodsTotal + ' шт.';
    if (outcomeEl) outcomeEl.textContent = goodsOut + ' шт.';
    if (endBalanceEl) endBalanceEl.textContent = goodsBal + ' шт.';
}

function generateGoodsReportData() {
    appData.goodsReport = [];
    const products = appData.products;
    products.forEach(p => {
        const stock = appData.goodsStock.find(s => s.name === p.name);
        const receipts = appData.goodsReceipt.filter(r => r.name === p.name);
        const totalIncome = receipts.reduce((sum, r) => sum + r.qty, 0);
        const writeoffs = appData.goodsWriteoff.filter(w => w.name === p.name);
        const totalOutcome = writeoffs.reduce((sum, w) => sum + w.qty, 0);
        const balance = stock ? stock.qty : p.qty;
        appData.goodsReport.push({
            id: getNextId('goodsReport'),
            name: p.name,
            income: totalIncome + (stock ? stock.qty : 0),
            outcome: totalOutcome,
            balance: balance
        });
    });
}

function generateCashReport() {
    const div = document.getElementById('cashReportResult');
    div.style.display = 'block';
    const total = appData.cashReport.reduce((s, c) => s + c.income, 0);
    const totalOut = appData.cashReport.reduce((s, c) => s + c.outcome, 0);
    div.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div style="background:white;padding:16px;border-radius:var(--radius-sm);border-left:4px solid var(--success);">
                <div style="font-size:11px;color:var(--gray-500);">Общий приход</div>
                <div style="font-size:22px;font-weight:700;color:var(--success);">${total.toLocaleString('ru-RU')} ₽</div>
            </div>
            <div style="background:white;padding:16px;border-radius:var(--radius-sm);border-left:4px solid var(--danger);">
                <div style="font-size:11px;color:var(--gray-500);">Общий расход</div>
                <div style="font-size:22px;font-weight:700;color:var(--danger);">${totalOut.toLocaleString('ru-RU')} ₽</div>
            </div>
            <div style="background:white;padding:16px;border-radius:var(--radius-sm);border-left:4px solid var(--accent);">
                <div style="font-size:11px;color:var(--gray-500);">Итого</div>
                <div style="font-size:22px;font-weight:700;color:var(--accent);">${(total - totalOut).toLocaleString('ru-RU')} ₽</div>
            </div>
        </div>
    `;
    showToast('Отчёт сформирован!', 'success');
}

function generateMC42() {
    const date = document.getElementById('mc42Date').value || new Date().toISOString().split('T')[0];
    document.getElementById('mc42DateDisplay').textContent = date;
    updateReportStats();
    showToast('Справка МС-42 сформирована!', 'success');
}

function generateReport2ap() {
    const from = document.getElementById('report2apFrom').value;
    const to = document.getElementById('report2apTo').value;
    if (!from || !to) {
        showToast('Выберите период!', 'warning');
        return;
    }
    appData.report2ap = [];
    const types = ['Письма', 'Газеты', 'Посылки', 'Бандероли', 'EMS'];
    let currentDate = new Date(from);
    const endDate = new Date(to);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        types.forEach(type => {
            let incoming, outgoing;
            switch(type) {
                case 'Письма':
                    incoming = Math.floor(Math.random() * 40) + 10;
                    outgoing = Math.floor(Math.random() * 35) + 5;
                    break;
                case 'Газеты':
                    incoming = Math.floor(Math.random() * 25) + 5;
                    outgoing = Math.floor(Math.random() * 20) + 3;
                    break;
                case 'Посылки':
                    incoming = Math.floor(Math.random() * 20) + 3;
                    outgoing = Math.floor(Math.random() * 18) + 2;
                    break;
                case 'Бандероли':
                    incoming = Math.floor(Math.random() * 15) + 2;
                    outgoing = Math.floor(Math.random() * 12) + 1;
                    break;
                case 'EMS':
                    incoming = Math.floor(Math.random() * 8) + 1;
                    outgoing = Math.floor(Math.random() * 6) + 1;
                    break;
                default:
                    incoming = Math.floor(Math.random() * 20) + 5;
                    outgoing = Math.floor(Math.random() * 15) + 3;
            }
            appData.report2ap.push({
                date: dateStr,
                incoming: incoming,
                outgoing: outgoing,
                type: type
            });
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    saveData();
    updateReportStats();
    renderReport2ap();
    showToast('Отчёт ф.2а-п сформирован за период ' + from + ' — ' + to + ' (' + appData.report2ap.length + ' записей)', 'success');
}

function renderReport2ap() {
    const tbody = document.getElementById('report2apTableBody');
    if (!tbody) return;
    
    // Очищаем tbody
    tbody.innerHTML = '';
    
    if (!appData.report2ap || appData.report2ap.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных. Нажмите "Сформировать".</td>`;
        tbody.appendChild(tr);
        return;
    }
    
    appData.report2ap.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.date}</td>
            <td>${r.incoming}</td>
            <td>${r.outgoing}</td>
            <td>${r.type}</td>
        `;
        tbody.appendChild(tr);
    });
}

function generateGoodsReport() {
    generateGoodsReportData();
    updateReportStats();
    renderGoodsReport();
    showToast('Отчёт по движению ТМЦ сформирован!', 'success');
}

function renderRPOReport() {
    const tbody = document.getElementById('rpoReportTableBody');
    if (!tbody) return;
    tbody.innerHTML = appData.rpoReport.map(r => `
        <tr>
            <td><strong>${r.track}</strong></td>
            <td>${r.type}</td>
            <td>${r.sender}</td>
            <td>${r.receiver}</td>
            <td>${r.date}</td>
            <td><span class="badge ${r.status === 'Вручено' ? 'badge-success' : r.status === 'Задерживается' ? 'badge-danger' : 'badge-warning'}">${r.status}</span></td>
        </tr>
    `).join('');
}

function renderGoodsReport() {
    const tbody = document.getElementById('goodsReportTableBody');
    if (!tbody) return;
    
    // Очищаем tbody
    tbody.innerHTML = '';
    
    if (!appData.goodsReport || appData.goodsReport.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных. Нажмите "Сформировать".</td>`;
        tbody.appendChild(tr);
        return;
    }
    
    appData.goodsReport.forEach(g => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${g.id}</td>
            <td><strong>${g.name}</strong></td>
            <td>${g.income}</td>
            <td>${g.outcome}</td>
            <td><strong>${g.balance}</strong></td>
        `;
        tbody.appendChild(tr);
    });
    
    // Обновляем карточки
    const goodsTotal = appData.goodsReport.reduce((s, g) => s + g.income, 0);
    const goodsOut = appData.goodsReport.reduce((s, g) => s + g.outcome, 0);
    const goodsBal = appData.goodsReport.reduce((s, g) => s + g.balance, 0);
    const startBalanceEl = document.getElementById('goodsStartBalance');
    const incomeEl = document.getElementById('goodsIncome');
    const outcomeEl = document.getElementById('goodsOutcome');
    const endBalanceEl = document.getElementById('goodsEndBalance');
    if (startBalanceEl) startBalanceEl.textContent = goodsTotal + ' шт.';
    if (incomeEl) incomeEl.textContent = goodsTotal + ' шт.';
    if (outcomeEl) outcomeEl.textContent = goodsOut + ' шт.';
    if (endBalanceEl) endBalanceEl.textContent = goodsBal + ' шт.';
}

function renderCashReport() {
    const tbody = document.getElementById('cashReportBody');
    if (!tbody) return;
    
    // Очищаем tbody
    tbody.innerHTML = '';
    
    if (!appData.cashReport || appData.cashReport.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    
    appData.cashReport.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.id}</td>
            <td>${c.operator}</td>
            <td>${c.income} ₽</td>
            <td>${c.outcome} ₽</td>
            <td>${c.date}</td>
            <td><span class="badge ${c.status === 'Закрыта' ? 'badge-success' : 'badge-warning'}">${c.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Служебные операции ---
function updateServiceStats() {
    const cash1 = appData.serviceCash.reduce((s, c) => s + c.income, 0);
    const cash2 = appData.serviceCash.reduce((s, c) => s + c.outcome, 0);
    document.getElementById('serviceCash1').textContent = cash1.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('serviceCash2').textContent = cash2.toLocaleString('ru-RU') + ' ₽';
    document.getElementById('serviceShift').textContent = '#' + (appData.serviceCash.length);
    document.getElementById('serviceStatus').textContent = shiftOpen ? 'Открыта' : 'Закрыта';
    document.getElementById('serviceStatus').style.color = shiftOpen ? 'var(--success)' : 'var(--danger)';
}

function openShift() {
    if (shiftOpen) { showToast('Смена уже открыта', 'warning'); return; }
    shiftOpen = true;
    shiftNumber = appData.serviceCash.length + 1;
    appData.serviceCash.push({
        id: getNextId('serviceCash'),
        operator: 'Сотрудник',
        income: 0,
        outcome: 0,
        date: new Date().toISOString().split('T')[0],
        status: 'Открыта'
    });
    saveData();
    updateServiceStats();
    renderServiceCash();
    showToast('Смена #' + shiftNumber + ' открыта! Время: ' + new Date().toLocaleTimeString(), 'success');
}

function closeShift() {
    if (!shiftOpen) { showToast('Смена уже закрыта', 'warning'); return; }
    const last = appData.serviceCash[appData.serviceCash.length - 1];
    if (last) {
        const income = Math.floor(Math.random() * 50000) + 10000;
        const outcome = Math.floor(Math.random() * 10000) + 1000;
        const hours = (Math.random() * 6 + 2).toFixed(1);
        const transactions = Math.floor(Math.random() * 30) + 5;
        const shiftReport = `
            <div class="shift-report" id="shiftReportContent">
                <h4 style="color:var(--primary);margin-bottom:12px;">📊 Отчёт о закрытии смены #${shiftNumber}</h4>
                <div class="shift-stat"><span class="label">Дата смены:</span><span class="value">${new Date().toISOString().split('T')[0]}</span></div>
                <div class="shift-stat"><span class="label">Продолжительность:</span><span class="value">${hours} часов</span></div>
                <div class="shift-stat"><span class="label">Количество операций:</span><span class="value">${transactions}</span></div>
                <div class="shift-stat"><span class="label">Общий приход:</span><span class="value" style="color:var(--success);">${income.toLocaleString('ru-RU')} ₽</span></div>
                <div class="shift-stat"><span class="label">Общий расход:</span><span class="value" style="color:var(--danger);">${outcome.toLocaleString('ru-RU')} ₽</span></div>
                <div class="shift-stat"><span class="label">Итоговый остаток:</span><span class="value" style="color:var(--accent);">${(income - outcome).toLocaleString('ru-RU')} ₽</span></div>
                <div class="shift-stat"><span class="label">Средний чек:</span><span class="value">${Math.round((income - outcome) / Math.max(transactions, 1)).toLocaleString('ru-RU')} ₽</span></div>
                <div style="margin-top:12px;padding-top:12px;border-top:2px solid var(--gray-200);font-size:13px;color:var(--gray-500);">
                    Оператор: Сотрудник · Подпись: ___________________
                </div>
            </div>
        `;
        last.income = income;
        last.outcome = outcome;
        last.status = 'Закрыта';
        last.shiftReport = shiftReport;
        shiftOpen = false;
        saveData();
        updateServiceStats();
        renderServiceCash();
        showToast('Смена #' + shiftNumber + ' закрыта!', 'success');
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal-window">
                <h3><i class="fas fa-file-alt" style="color:var(--accent);"></i> Отчёт о закрытии смены</h3>
                ${shiftReport}
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-check"></i> Закрыть</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

function processCollection() {
    if (!shiftOpen) { showToast('Смена закрыта!', 'error'); return; }
    const amount = Math.floor(Math.random() * 50000) + 20000;
    showToast('Инкассация выполнена! Сумма: ' + amount.toLocaleString('ru-RU') + ' ₽', 'success');
    const last = appData.serviceCash[appData.serviceCash.length - 1];
    if (last) {
        last.income += amount;
        saveData();
        updateServiceStats();
    }
}

function renderServiceCash() {
    const tbody = document.getElementById('serviceCashBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!appData.serviceCash || appData.serviceCash.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    appData.serviceCash.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.id}</td>
            <td>${c.operator}</td>
            <td>${c.income} ₽</td>
            <td>${c.outcome} ₽</td>
            <td>${c.date}</td>
            <td><span class="badge ${c.status === 'Закрыта' ? 'badge-success' : 'badge-warning'}">${c.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Обратная связь ---
function submitFeedback(e) {
    e.preventDefault();
    
    const form = document.getElementById('feedbackForm');
    const formData = new FormData(form);
    
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
    btn.disabled = true;
    
    // ЗДЕСЬ ЗАМЕНИТЕ ССЫЛКУ
    fetch('https://formspree.io/f/xjyvvgbp', {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'application/json'
        }
    })
    .then(response => {
        if (response.ok) {
            document.getElementById('feedbackForm').style.display = 'none';
            document.getElementById('feedbackSuccess').classList.add('active');
            showToast('Сообщение отправлено! Спасибо за обратную связь.', 'success');
        } else {
            showToast('Ошибка при отправке. Попробуйте позже.', 'error');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    })
    .catch(error => {
        showToast('Ошибка соединения. Проверьте интернет.', 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
    
    return false;
}

// --- Общие функции ---
function deleteItem(key, id) {
    if (!confirm('Удалить запись?')) return;
    appData[key] = appData[key].filter(item => item.id !== id);
    saveData();
    renderAll();
    showToast('Запись удалена', 'info');
}

function updateBackStats() {
    const zones = { 'A': 0, 'B': 0, 'C': 0, 'D': 0 };
    appData.addressStorage.forEach(a => {
        const letter = a.cell.charAt(0).toUpperCase();
        if (zones[letter] !== undefined) zones[letter]++;
    });
    document.getElementById('zoneA').textContent = zones.A;
    document.getElementById('zoneB').textContent = zones.B;
    document.getElementById('zoneC').textContent = zones.C;
    document.getElementById('zoneD').textContent = zones.D;
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
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(60px)';
        toast.style.transition = 'all 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}

// ================================================================
//  НАВИГАЦИЯ И ВКЛАДКИ
// ================================================================
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
    });
});

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

document.querySelectorAll('.tabs-header .tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const parent = this.closest('.tabs-container');
        parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const target = document.getElementById(this.dataset.tab);
        if (target) target.classList.add('active');
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
    });
});

// ================================================================
//  СИСТЕМА ГОРОД
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
    if (!payer) { showToast('Введите ФИО плательщика!', 'error'); return false; }
    if (!account) { showToast('Введите лицевой счёт!', 'error'); return false; }
    if (!amount || amount <= 0) { showToast('Введите корректную сумму!', 'error'); return false; }
    cityCart.push({
        id: Date.now(),
        type: 'service',
        service: service,
        payer: payer,
        account: account,
        amount: amount,
        date: date,
        purpose: purpose || 'Оплата услуги',
        status: 'В корзине'
    });
    updateCityCartBadge();
    showToast('Услуга "' + service + '" добавлена в корзину! Сумма: ' + amount.toLocaleString('ru-RU') + ' ₽', 'success');
    const resultDiv = document.getElementById('servicePaymentResult');
    resultDiv.style.display = 'block';
    resultDiv.className = 'result-box success';
    resultDiv.innerHTML = `
        <i class="fas fa-check-circle" style="font-size:24px;"></i>
        <strong style="font-size:16px;">Услуга добавлена в корзину!</strong>
        <div style="margin-top:12px;text-align:left;font-weight:400;font-size:14px;line-height:1.8;">
            <div><strong>Услуга:</strong> ${service}</div>
            <div><strong>Сумма:</strong> ${amount.toLocaleString('ru-RU')} ₽</div>
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--gray-200);color:var(--accent);font-size:13px;">
                🛒 Товар в корзине. Перейдите в корзину для оплаты.
            </div>
        </div>
    `;
    document.getElementById('servicePaymentForm').style.display = 'none';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-outline';
    resetBtn.style.marginTop = '12px';
    resetBtn.innerHTML = '<i class="fas fa-plus"></i> Новая оплата';
    resetBtn.onclick = function() {
        document.getElementById('servicePaymentForm').style.display = 'block';
        document.getElementById('servicePaymentForm').reset();
        resultDiv.style.display = 'none';
        this.remove();
    };
    resultDiv.appendChild(resetBtn);
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
    if (!payer) { showToast('Введите ФИО заёмщика!', 'error'); return false; }
    if (!contract) { showToast('Введите номер кредитного договора!', 'error'); return false; }
    if (!amount || amount <= 0) { showToast('Введите корректную сумму!', 'error'); return false; }
    cityCart.push({
        id: Date.now(),
        type: 'credit',
        bank: bank,
        payer: payer,
        contract: contract,
        amount: amount,
        date: date,
        paymentType: type,
        status: 'В корзине'
    });
    updateCityCartBadge();
    showToast('Кредит "' + bank + '" добавлен в корзину! Сумма: ' + amount.toLocaleString('ru-RU') + ' ₽', 'success');
    const resultDiv = document.getElementById('creditPaymentResult');
    resultDiv.style.display = 'block';
    resultDiv.className = 'result-box success';
    resultDiv.innerHTML = `
        <i class="fas fa-check-circle" style="font-size:24px;"></i>
        <strong style="font-size:16px;">Кредит добавлен в корзину!</strong>
        <div style="margin-top:12px;text-align:left;font-weight:400;font-size:14px;line-height:1.8;">
            <div><strong>Банк:</strong> ${bank}</div>
            <div><strong>Сумма:</strong> ${amount.toLocaleString('ru-RU')} ₽</div>
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--gray-200);color:var(--accent);font-size:13px;">
                🛒 Товар в корзине. Перейдите в корзину для оплаты.
            </div>
        </div>
    `;
    document.getElementById('creditPaymentForm').style.display = 'none';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-outline';
    resetBtn.style.marginTop = '12px';
    resetBtn.innerHTML = '<i class="fas fa-plus"></i> Новое погашение';
    resetBtn.onclick = function() {
        document.getElementById('creditPaymentForm').style.display = 'block';
        document.getElementById('creditPaymentForm').reset();
        resultDiv.style.display = 'none';
        this.remove();
    };
    resultDiv.appendChild(resetBtn);
    return false;
}

// --- История платежей ---
function fillHistoryModal() {
    renderHistoryData();
}

function renderHistoryData(filteredData) {
    const tbody = document.getElementById('historyModalBody');
    if (!tbody) return;
    
    // Очищаем tbody
    tbody.innerHTML = '';
    
    let data = filteredData || [...appData.cityPayments, ...appData.utilityPayments];
    
    if (data.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет платежей</td>`;
        tbody.appendChild(tr);
        document.getElementById('historyTotalAmount').textContent = '0 ₽';
        return;
    }
    
    data.sort((a, b) => {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        return 0;
    });
    
    let total = 0;
    data.forEach(p => {
        total += p.amount || 0;
        let details = '';
        if (p.account) details += 'Счёт: ' + p.account;
        if (p.contract) details += (details ? ' | ' : '') + 'Договор: ' + p.contract;
        if (p.bank) details += (details ? ' | ' : '') + 'Банк: ' + p.bank;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.id}</td>
            <td>${p.payer || '—'}</td>
            <td>${p.service || '—'}${details ? '<br><span style="font-size:10px;color:var(--gray-400);">' + details + '</span>' : ''}</td>
            <td>${(p.amount || 0).toLocaleString('ru-RU')} ₽</td>
            <td>${p.date || '—'}</td>
            <td><span class="badge ${p.status === 'Оплачено' ? 'badge-success' : 'badge-warning'}">${p.status || '—'}</span></td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('historyTotalAmount').textContent = total.toLocaleString('ru-RU') + ' ₽';
}

function filterHistory() {
    const dateFrom = document.getElementById('historyDateFrom').value;
    const dateTo = document.getElementById('historyDateTo').value;
    const search = document.getElementById('historySearch').value.toLowerCase().trim();
    let data = [...appData.cityPayments, ...appData.utilityPayments];
    if (dateFrom) {
        data = data.filter(p => p.date >= dateFrom);
    }
    if (dateTo) {
        data = data.filter(p => p.date <= dateTo);
    }
    if (search) {
        data = data.filter(p => 
            (p.payer || '').toLowerCase().includes(search) ||
            (p.service || '').toLowerCase().includes(search)
        );
    }
    renderHistoryData(data);
    showToast('Найдено ' + data.length + ' записей', 'info');
}

function resetHistoryFilter() {
    document.getElementById('historyDateFrom').value = '';
    document.getElementById('historyDateTo').value = '';
    document.getElementById('historySearch').value = '';
    renderHistoryData();
    showToast('Фильтры сброшены', 'info');
}

function exportHistoryExcel() {
    const cityData = appData.cityPayments || [];
    const utilityData = appData.utilityPayments || [];
    const allData = [...cityData, ...utilityData];
    
    if (allData.length === 0) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    
    if (typeof XLSX !== 'undefined') {
        exportHistoryXLSX(allData);
        return;
    }
    
    // CSV с табуляцией
    const delimiter = '\t';
    let csv = '';
    const headers = ['№', 'Плательщик', 'Услуга', 'Сумма (₽)', 'Дата', 'Статус', 'Детали'];
    csv += headers.join(delimiter) + '\n';
    
    allData.forEach(p => {
        let details = '';
        if (p.account) details += 'Счёт: ' + p.account;
        if (p.contract) details += (details ? ' | ' : '') + 'Договор: ' + p.contract;
        if (p.bank) details += (details ? ' | ' : '') + 'Банк: ' + p.bank;
        
        const row = [
            p.id || '—',
            p.payer || '—',
            p.service || '—',
            (p.amount || 0),
            p.date || '—',
            p.status || '—',
            details
        ];
        csv += row.join(delimiter) + '\n';
    });
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `История_платежей_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('История выгружена в Excel!', 'success');
}

function exportHistoryXLSX(allData) {
    const headers = ['№', 'Плательщик', 'Услуга', 'Сумма (₽)', 'Дата', 'Статус', 'Детали'];
    const rows = [headers];
    
    allData.forEach(p => {
        let details = '';
        if (p.account) details += 'Счёт: ' + p.account;
        if (p.contract) details += (details ? ' | ' : '') + 'Договор: ' + p.contract;
        if (p.bank) details += (details ? ' | ' : '') + 'Банк: ' + p.bank;
        
        rows.push([
            p.id || '—',
            p.payer || '—',
            p.service || '—',
            (p.amount || 0),
            p.date || '—',
            p.status || '—',
            details
        ]);
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Автоподбор ширины колонок
    const colWidths = [];
    rows.forEach(row => {
        row.forEach((cell, i) => {
            const len = String(cell).length;
            if (!colWidths[i] || len > colWidths[i]) {
                colWidths[i] = Math.min(len * 1.2 + 2, 50);
            }
        });
    });
    ws['!cols'] = colWidths.map(w => ({ wch: Math.max(w || 12, 12) }));
    
    XLSX.utils.book_append_sheet(wb, ws, 'История');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `История_платежей_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('История выгружена в Excel!', 'success');
}

// ================================================================
//  ОТЧЁТ ПО ДВИЖЕНИЮ РПО
// ================================================================
function getRPOData() {
    return {
        rows: [
            {
                name: 'Заказные почтовые отправления и уведомления с вручении, кроме разряда "Судебные" и "Административные"',
                start_ops: 22, start_delivery: 20, start_total: 42,
                received: 15, delivered: 12, lost: 0, forwarded: 1,
                end_ops: 25, end_delivery: 18, end_total: 43
            },
            {
                name: 'Заказные почтовые отправления разряда "Судебные" и "Административные"',
                start_ops: 5, start_delivery: 3, start_total: 8,
                received: 4, delivered: 2, lost: 0, forwarded: 0,
                end_ops: 7, end_delivery: 3, end_total: 10
            },
            {
                name: 'Мелкие пакеты',
                start_ops: 10, start_delivery: 8, start_total: 18,
                received: 6, delivered: 5, lost: 1, forwarded: 0,
                end_ops: 11, end_delivery: 7, end_total: 18
            },
            {
                name: 'Простые мелкие пакеты',
                start_ops: 15, start_delivery: 10, start_total: 25,
                received: 8, delivered: 7, lost: 0, forwarded: 2,
                end_ops: 16, end_delivery: 8, end_total: 24
            },
            {
                name: 'Мешок М',
                start_ops: 3, start_delivery: 2, start_total: 5,
                received: 2, delivered: 1, lost: 0, forwarded: 0,
                end_ops: 4, end_delivery: 2, end_total: 6
            },
            {
                name: 'Письменная корреспонденция с объявленной ценностью',
                start_ops: 8, start_delivery: 5, start_total: 13,
                received: 4, delivered: 3, lost: 0, forwarded: 1,
                end_ops: 9, end_delivery: 4, end_total: 13
            }
        ]
    };
}

function renderRPOMovement() {
    const data = getRPOData();
    const tbody = document.getElementById('rpoMovementBody');
    if (!tbody) return;
    
    let totals = { start_ops: 0, start_delivery: 0, start_total: 0, received: 0, delivered: 0, lost: 0, forwarded: 0, end_ops: 0, end_delivery: 0, end_total: 0 };
    
    let html = '';
    data.rows.forEach((row) => {
        totals.start_ops += row.start_ops;
        totals.start_delivery += row.start_delivery;
        totals.start_total += row.start_total;
        totals.received += row.received;
        totals.delivered += row.delivered;
        totals.lost += row.lost;
        totals.forwarded += row.forwarded;
        totals.end_ops += row.end_ops;
        totals.end_delivery += row.end_delivery;
        totals.end_total += row.end_total;
        
        html += `
            <tr>
                <td style="text-align:left;font-size:11px;padding:4px 6px;">${row.name}</td>
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
            <td style="padding:4px 6px;font-weight:700;">${totals.start_ops}</td>
            <td style="padding:4px 6px;font-weight:700;">${totals.start_delivery}</td>
            <td style="padding:4px 6px;font-weight:700;">${totals.start_total}</td>
            <td style="padding:4px 6px;font-weight:700;">${totals.received}</td>
            <td style="padding:4px 6px;font-weight:700;">${totals.delivered}</td>
            <td style="padding:4px 6px;font-weight:700;">${totals.lost}</td>
            <td style="padding:4px 6px;font-weight:700;">${totals.forwarded}</td>
            <td style="padding:4px 6px;font-weight:700;">${totals.end_ops}</td>
            <td style="padding:4px 6px;font-weight:700;">${totals.end_delivery}</td>
            <td style="padding:4px 6px;font-weight:700;">${totals.end_total}</td>
        </tr>
    `;
    
    tbody.innerHTML = html;
}

function refreshRPOTable() {
    const now = new Date();
    const dateStr = now.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    document.getElementById('rpoReportDate').textContent = `${dateStr} г.`;
    renderRPOMovement();
    showToast('Данные обновлены!', 'success');
}

// Вместо exportRPOExcel
function exportRPOExcel() {
    const table = document.getElementById('rpoMovementTable');
    if (!table) {
        showToast('Таблица не найдена!', 'error');
        return;
    }
    const tbody = table.querySelector('tbody');
    if (!tbody || tbody.rows.length === 0) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    exportToExcelTable('rpoMovementTable', 'Отчёт_РПО');
}

function printRPOReport() {
    exportToPDF('postal-rpo', 'Отчёт_по_движению_РПО');
}

// ================================================================
//  ЖУРНАЛ ОПЕРАЦИЙ
// ================================================================
function getJournalData() {
    return [
        { date: '24.08.2026', time: '16:24:13', window: 'Окно 01', user: 'Будушева Надежда Ивановна', check: '255', fd: '21029', amount: 548.00, status: 'Завершена' },
        { date: '24.08.2026', time: '16:24:13', window: 'Окно 01', user: 'Будушева Надежда Ивановна', check: '254', fd: '21078', amount: 192.00, status: 'Завершена' },
        { date: '24.08.2026', time: '16:24:13', window: 'Окно 01', user: 'Будушева Надежда Ивановна', check: '253', fd: '21076', amount: 15000.00, status: 'Завершена' },
        { date: '24.08.2026', time: '16:24:13', window: 'Окно 01', user: 'Будушева Надежда Ивановна', check: '252', fd: '21075', amount: 425.00, status: 'Завершена' },
        { date: '24.08.2026', time: '15:10:45', window: 'Окно 02', user: 'Петров Сергей Викторович', check: '251', fd: '21074', amount: 1200.00, status: 'Завершена' },
        { date: '24.08.2026', time: '14:55:22', window: 'Окно 01', user: 'Будушева Надежда Ивановна', check: '250', fd: '21073', amount: 89.50, status: 'Завершена' },
        { date: '24.08.2026', time: '14:30:10', window: 'Окно 03', user: 'Сидорова Елена Михайловна', check: '249', fd: '21072', amount: 2340.00, status: 'В процессе' },
        { date: '23.08.2026', time: '17:20:33', window: 'Окно 01', user: 'Будушева Надежда Ивановна', check: '248', fd: '21071', amount: 780.00, status: 'Завершена' },
    ];
}

function renderJournal() {
    const data = getJournalData();
    const tbody = document.getElementById('journalBody');
    if (!tbody) return;
    
    // СОХРАНЯЕМ ДАННЫЕ В appData ДЛЯ ЭКСПОРТА
    appData.journal = data;
    
    tbody.innerHTML = '';
    
    if (!data || data.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="8" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td>`;
        tbody.appendChild(tr);
        return;
    }
    
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.date}</td>
            <td>${row.time}</td>
            <td>${row.window}</td>
            <td>${row.user}</td>
            <td>${row.check}</td>
            <td>${row.fd}</td>
            <td><strong>${row.amount.toFixed(2).replace('.', ',')}</strong></td>
            <td><span class="${row.status === 'Завершена' ? 'journal-status-completed' : 'journal-status-pending'}">${row.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// ================================================================
//  ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ РЕНДЕРИНГА
// ================================================================
function renderLotteryTable() {
    const tbody = document.getElementById('lotteryBody');
    if (!tbody) return;
    if (!appData.lottery || appData.lottery.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.lottery.map(l => `
        <tr>
            <td>${l.ticket}</td>
            <td>${l.client}</td>
            <td>${l.amount} ₽</td>
            <td>${l.date}</td>
            <td><span class="badge ${l.status === 'Выигрыш' ? 'badge-success' : 'badge-warning'}">${l.status}</span></td>
        </tr>
    `).join('');
}

function renderInsuranceTable() {
    const tbody = document.getElementById('insuranceBody');
    if (!tbody) return;
    if (!appData.insurance || appData.insurance.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.insurance.map(i => `
        <tr>
            <td>${i.policy}</td>
            <td>${i.client}</td>
            <td>${i.passportSeries || '—'} ${i.passportNumber || '—'}</td>
            <td>${i.birthdate || '—'}</td>
            <td>${i.amount} ₽</td>
            <td>${i.date}</td>
            <td><span class="badge ${i.status === 'Активен' ? 'badge-success' : 'badge-warning'}">${i.status}</span></td>
        </tr>
    `).join('');
}

function renderSIMTable() {
    const tbody = document.getElementById('simBody');
    if (!tbody) return;
    if (!appData.sim || appData.sim.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.sim.map(s => `
        <tr>
            <td>${s.sim}</td>
            <td>${s.phone}</td>
            <td>${s.operator}</td>
            <td>${s.tariff}</td>
            <td><span class="badge ${s.status === 'Активна' ? 'badge-success' : 'badge-warning'}">${s.status}</span></td>
        </tr>
    `).join('');
}

function renderDigitalTable() {
    const tbody = document.getElementById('digitalBody');
    if (!tbody) return;
    if (!appData.digital || appData.digital.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.digital.map(d => `
        <tr>
            <td><strong>${d.service}</strong></td>
            <td>${d.client}</td>
            <td>${d.price} ₽</td>
            <td>${d.date}</td>
            <td><span class="badge ${d.status === 'Активна' ? 'badge-success' : 'badge-warning'}">${d.status}</span></td>
        </tr>
    `).join('');
}

function renderTelegramTable() {
    const tbody = document.getElementById('telegramBody');
    if (!tbody) return;
    if (!appData.telegram || appData.telegram.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.telegram.map(t => `
        <tr>
            <td>${t.id}</td>
            <td>${t.sender}</td>
            <td>${t.senderAddress || '—'}</td>
            <td>${t.receiver}</td>
            <td>${t.receiverAddress || '—'}</td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.text || '—'}</td>
            <td>${t.words || 0}</td>
            <td>${t.price || 0} ₽</td>
            <td>${t.date}</td>
            <td><span class="badge ${t.status === 'Отправлена' ? 'badge-success' : 'badge-warning'}">${t.status}</span></td>
        </tr>
    `).join('');
}

function renderPensionTable() {
    const tbody = document.getElementById('pensionBody');
    if (!tbody) return;
    if (!appData.pension || appData.pension.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.pension.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.name}</td>
            <td>${p.snils}</td>
            <td>${p.amount} ₽</td>
            <td>${p.type}</td>
            <td>${p.date}</td>
            <td><span class="badge ${p.status === 'Выплачено' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
        </tr>
    `).join('');
}

function renderCityPaymentsTable() {
    const tbody = document.getElementById('cityPaymentsBody');
    if (!tbody) return;
    if (!appData.cityPayments || appData.cityPayments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.cityPayments.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.payer}</td>
            <td>${p.service}</td>
            <td>${p.amount} ₽</td>
            <td>${p.date}</td>
            <td><span class="badge ${p.status === 'Оплачено' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
        </tr>
    `).join('');
}

function renderUtilityTable() {
    const tbody = document.getElementById('utilityPaymentsBody');
    if (!tbody) return;
    if (!appData.utilityPayments || appData.utilityPayments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--gray-500);">Нет данных</td></tr>`;
        return;
    }
    tbody.innerHTML = appData.utilityPayments.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.payer}</td>
            <td>${p.service}</td>
            <td>${p.amount} ₽</td>
            <td>${p.date}</td>
            <td><span class="badge ${p.status === 'Оплачено' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
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
    if (search) {
        data = data.filter(row => row.user.toLowerCase().includes(search) || row.check.includes(search) || row.fd.includes(search));
    }
    if (dateFrom) {
        data = data.filter(row => row.date >= dateFrom.replace(/-/g, '.'));
    }
    if (dateTo) {
        data = data.filter(row => row.date <= dateTo.replace(/-/g, '.'));
    }
    if (fd) {
        data = data.filter(row => row.fd.includes(fd));
    }
    if (check) {
        data = data.filter(row => row.check.includes(check));
    }
    if (windowFilter) {
        data = data.filter(row => row.window === windowFilter);
    }
    const tbody = document.getElementById('journalBody');
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--gray-500);">Записей не найдено</td></tr>`;
        return;
    }
    tbody.innerHTML = data.map(row => `
        <tr>
            <td>${row.date}</td>
            <td>${row.time}</td>
            <td>${row.window}</td>
            <td>${row.user}</td>
            <td>${row.check}</td>
            <td>${row.fd}</td>
            <td><strong>${row.amount.toFixed(2).replace('.', ',')}</strong></td>
            <td><span class="${row.status === 'Завершена' ? 'journal-status-completed' : 'journal-status-pending'}">${row.status}</span></td>
        </tr>
    `).join('');
    showToast(`Найдено ${data.length} записей`, 'info');
}

function resetJournalFilters() {
    document.getElementById('journalSearch').value = '';
    document.getElementById('journalDateFrom').value = '';
    document.getElementById('journalDateTo').value = '';
    document.getElementById('journalFd').value = '';
    document.getElementById('journalCheck').value = '';
    document.getElementById('journalWindow').value = '';
    renderJournal();
    showToast('Фильтры сброшены', 'info');
}

function exportJournalExcel() {
    let data = appData.journal;
    if (!data || data.length === 0) {
        data = getJournalData();
        appData.journal = data;
    }
    if (!data || data.length === 0) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    
    // Используем XLSX если доступен, иначе CSV
    if (typeof XLSX !== 'undefined') {
        exportJournalXLSX(data);
        return;
    }
    
    // CSV с табуляцией для автоподбора ширины
    const delimiter = '\t';
    let csv = '';
    const headers = ['Дата', 'Время', 'Номер окна', 'Пользователь', 'Номер чека', 'Номер ФД', 'Сумма (₽)', 'Статус'];
    csv += headers.join(delimiter) + '\n';
    
    data.forEach(row => {
        const rowData = [
            row.date,
            row.time,
            row.window,
            row.user,
            row.check,
            row.fd,
            row.amount.toFixed(2),
            row.status
        ];
        csv += rowData.join(delimiter) + '\n';
    });
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Журнал_операций_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Журнал выгружен в Excel!', 'success');
}

function exportJournalXLSX(data) {
    // Подготавливаем данные для XLSX
    const headers = ['Дата', 'Время', 'Номер окна', 'Пользователь', 'Номер чека', 'Номер ФД', 'Сумма (₽)', 'Статус'];
    const rows = [headers];
    
    data.forEach(row => {
        rows.push([
            row.date,
            row.time,
            row.window,
            row.user,
            row.check,
            row.fd,
            row.amount.toFixed(2),
            row.status
        ]);
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Автоподбор ширины колонок
    const colWidths = [];
    rows.forEach(row => {
        row.forEach((cell, i) => {
            const len = String(cell).length;
            if (!colWidths[i] || len > colWidths[i]) {
                colWidths[i] = Math.min(len * 1.2 + 2, 40);
            }
        });
    });
    ws['!cols'] = colWidths.map(w => ({ wch: Math.max(w || 12, 12) }));
    
    XLSX.utils.book_append_sheet(wb, ws, 'Журнал');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Журнал_операций_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Журнал выгружен в Excel!', 'success');
}

// ================================================================
//  11. 3D-ЭФФЕКТ ДЛЯ КАРТОЧЕК
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('.card-3d[data-tilt]');
    cards.forEach(card => {
        card.style.setProperty('--mouse-x', '50%');
        card.style.setProperty('--mouse-y', '50%');
        card.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const percentX = (x / rect.width) * 100;
            const percentY = (y / rect.height) * 100;
            this.style.setProperty('--mouse-x', percentX + '%');
            this.style.setProperty('--mouse-y', percentY + '%');
            const rotateX = ((y - centerY) / centerY) * -12;
            const rotateY = ((x - centerX) / centerX) * 12;
            this.style.transform = `
                perspective(800px)
                rotateX(${rotateX}deg)
                rotateY(${rotateY}deg)
                translateY(-6px)
                scale(1.02)
            `;
            this.style.boxShadow = `
                0 20px 60px rgba(0,0,0,0.35),
                0 0 40px rgba(240,180,41,0.08)
            `;
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)';
            this.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
            this.style.setProperty('--mouse-x', '50%');
            this.style.setProperty('--mouse-y', '50%');
        });
        card.addEventListener('mouseenter', function() {
            this.style.transition = 'transform 0.1s ease, box-shadow 0.3s ease';
        });
    });
});

// ================================================================
//  ИНИЦИАЛИЗАЦИЯ
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('authScreen').style.display = 'flex';
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateFrom = document.getElementById('searchDateFrom');
    const dateTo = document.getElementById('searchDateTo');
    if (dateFrom) dateFrom.value = firstDay.toISOString().split('T')[0];
    if (dateTo) dateTo.value = now.toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    const serviceDate = document.getElementById('serviceDate');
    const creditDate = document.getElementById('creditDate');
    if (serviceDate) serviceDate.value = today;
    if (creditDate) creditDate.value = today;
    initData();
    renderRPOMovement();
    renderJournal();
});

console.log('🏤 v10.0 — ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ');
console.log('✅ Все функции доработаны и исправлены!');
console.log('🔑 Ключи доступа: ' + VALID_KEYS.join(', '));
console.log('💾 Данные сохраняются в localStorage');
