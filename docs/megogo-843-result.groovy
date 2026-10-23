import rtm.bonus.client.BonusClient

// Ключ зберігає код у межах одного чека.
// Результат правила може запускатися для кількох позицій чека,
// але код буде взято з центрального списку лише один раз.
final String issueKey = 'megogo_code_rule_843'
final String sequenceName = 'pos.seq_megogo_code_843'

String getMegogoCode() {
    String issuedCode = check.orderClient.interimData[issueKey]
    if (issuedCode != null) return issuedCode

    try {
        // nextval є атомарним: різні каси одержують різні номери.
        // Таблиця містить фактичні коди MEGOGO, завантажені перед стартом акції.
        String query = """
            with next_code as (
                select nextval('${sequenceName}')::integer as sequence_no
            )
            select c.megogo_code
            from pos.megogo_code_843 c
            join next_code n on n.sequence_no = c.sequence_no
        """

        ArrayList<Map> rows = (master.bonusClient as BonusClient).getServerQuery(query)
        if (rows != null && !rows.isEmpty() && rows.first().get('megogo_code') != null) {
            issuedCode = rows.first().get('megogo_code').toString().trim()
            check.orderClient.interimData[issueKey] = issuedCode
            return issuedCode
        }

        master.log('Правило 843: у списку не залишилося кодів MEGOGO.')
    } catch (Exception ex) {
        master.log("Правило 843: не вдалося отримати код MEGOGO: ${ex.message}")
    }

    return null
}

String megogoCode = getMegogoCode()

// Без коду нічого не друкуємо: покупцеві не буде видано некоректний код.
if (megogoCode == null || megogoCode == '') return

def receiptText = """
#
            ВІТАЄМО!

Ваш чек від 500 грн.
Ви отримали код MEGOGO:

#   ${megogoCode}
#
Активуйте код у застосунку
або на сайті MEGOGO.
Збережіть цей чек.
"""

// Один ключ правила = один додатковий блок друку в чеку.
check.messageSplitCheck[ruleLoyal.code_rule] = "$receiptText"
