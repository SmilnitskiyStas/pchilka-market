import wslite.rest.RESTClient

// Результат правила викликається для позицій чека.
// Прапорець не дозволяє робити повторний HTTP-виклик або друк у тому самому чеку.
final String testKey = 'megogo_api_test_rule_843'

if (check.orderClient.interimData[testKey] == null) {
    try {
        def api = new RESTClient('https://pchilka-market.ua')
        def response = api.get(path: '/api/health/db')

        if (response.statusCode == 200 && response.json?.ok == true) {
            check.orderClient.interimData[testKey] = 'ok'
            check.messageSplitCheck[ruleLoyal.code_rule] = '-*-' 
        } else {
            master.log("Правило 843: API повернув код ${response.statusCode}")
        }
    } catch (Exception ex) {
        // Помилка тесту не впливає на оплату та не друкується покупцеві.
        master.log("Правило 843: API недоступний: ${ex.message}")
    }
}
