// Правило 843: виконується лише при завершенні успішної оплати.
// Сума перевіряється за фінальною сумою чека після інших знижок.
if (check.state != 2) return false

def total = check.orderClient.sum_order ?: 0
return total >= 500
