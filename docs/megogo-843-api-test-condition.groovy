// Тест зв'язку правила 843 з API застосунку.
// Працює тільки після успішної оплати на касі 371.
if (check.state != 2) return false

def total = check.orderClient.sum_order ?: 0
return total >= 1 && check.orderClient.id_workplace == 371
