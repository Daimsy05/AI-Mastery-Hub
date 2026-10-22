let currentItem = '';
let currentAmount = 0;

// Open Modal
function openCheckout(itemName, price) {
  currentItem = itemName;
  currentAmount = price;
  
  document.getElementById('checkoutItemName').innerText = itemName;
  document.getElementById('checkoutPrice').innerText = `$${price.toFixed(2)}`;
  document.getElementById('checkoutModal').style.display = 'flex';
}

// Close Modal
function closeCheckout() {
  document.getElementById('checkoutModal').style.display = 'none';
  document.getElementById('checkoutEmail').value = '';
}

// Crypto Payment Flow (NOWPayments)
async function payWithCrypto() {
  const email = document.getElementById('checkoutEmail').value;
  if (!email) return alert("Please enter your email first.");

  const btn = event.target;
  btn.innerText = 'Connecting to Blockchain...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/pay/crypto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemName: currentItem, amount: currentAmount, email })
    });
    const data = await res.json();
    
    if (data.invoice_url) {
      window.location.href = data.invoice_url;
    } else {
      alert('Error creating invoice.');
      btn.innerText = 'Pay with Crypto';
      btn.disabled = false;
    }
  } catch (err) {
    alert('Network error');
    btn.innerText = 'Pay with Crypto';
    btn.disabled = false;
  }
}
// Automatically update the copyright year
document.getElementById('year').textContent = new Date().getFullYear();
// M-Pesa Payment Flow (IntaSend)
async function payWithMpesa() {
  const phone = prompt("Enter your M-Pesa phone number (e.g., 254712345678):");
  if (!phone) return;

  const btn = event.target;
  btn.innerText = 'Sending STK Push...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/pay/mpesa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemName: currentItem, amount: currentAmount, phone })
    });
    const data = await res.json();
    
    if (data.success) {
      alert("Success! Check your phone to enter your M-Pesa PIN.");
      closeCheckout();
    } else {
      alert(data.error || 'Error with M-Pesa.');
    }
  } catch (err) {
    alert('Network error');
  } finally {
    btn.innerText = 'Pay with M-Pesa (KE)';
    btn.disabled = false;
  }
}