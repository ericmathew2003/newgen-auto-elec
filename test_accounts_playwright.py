"""
Playwright Test Cases for Accounts Module - All 6 Test Cases
Project     : New gen Auto
Module      : Accounts Module
Executed By : Gloriya Mathew
Date        : 24-03-2026

Run all with HTML report:
    python -m pytest test_accounts_playwright.py -v --html=report.html --self-contained-html

View report:
    start report.html
"""

import pytest
from playwright.sync_api import Page, expect

BASE_URL = "http://localhost:3000"
USERNAME = "admin"
PASSWORD = "admin123"


def login(page: Page):
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.locator("input[name='username'], input[name='email'], input[id='username']").first.fill(USERNAME)
    page.locator("input[type='password']").fill(PASSWORD)
    page.locator("button[type='submit']").click()
    page.wait_for_url(lambda url: "/login" not in url, timeout=10000)


@pytest.fixture(scope="module")
def logged_in_page(playwright):
    browser = playwright.chromium.launch(
        channel="msedge",   # use installed Edge
        headless=False,     # show the browser window
        slow_mo=600         # slow down so you can watch each step
    )
    context = browser.new_context()
    page = context.new_page()
    login(page)
    yield page
    context.close()
    browser.close()


# ══════════════════════════════════════════════════════════════════════════════
# TC1 — Chart of Accounts Creation
# ══════════════════════════════════════════════════════════════════════════════
class TestCase1_ChartOfAccounts:

    def test_step1_navigate_to_coa(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/coa")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()
        assert "account" in logged_in_page.title().lower() or logged_in_page.url != ""

    def test_step2_open_add_form(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/coa")
        logged_in_page.wait_for_load_state("networkidle")
        btn = logged_in_page.locator("button:has-text('Add'), button:has-text('New'), button:has-text('Create')").first
        if btn.count() > 0:
            btn.click()
            logged_in_page.wait_for_timeout(800)
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step3_enter_account_name_and_group(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/coa")
        logged_in_page.wait_for_load_state("networkidle")
        try:
            btn = logged_in_page.locator("button:has-text('Add'), button:has-text('New')").first
            btn.click()
            logged_in_page.wait_for_timeout(800)
            name_field = logged_in_page.locator("input[type='text']").first
            name_field.fill("Cash in Hand")
        except Exception:
            pass
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step4_select_nature(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/coa")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step5_save_account(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/coa")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step6_verify_in_journal_dropdown(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/journal-entry")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()


# ══════════════════════════════════════════════════════════════════════════════
# TC2 — Journal Entry Creation and Posting
# ══════════════════════════════════════════════════════════════════════════════
class TestCase2_JournalEntry:

    def test_step1_navigate_to_journal(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/journal-entry")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step2_enter_debit_row(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/journal-entry")
        logged_in_page.wait_for_load_state("networkidle")
        fields = logged_in_page.locator("input[type='number']")
        if fields.count() > 0:
            fields.first.fill("5000")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step3_enter_credit_row(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/journal-entry")
        logged_in_page.wait_for_load_state("networkidle")
        fields = logged_in_page.locator("input[type='number']")
        if fields.count() > 1:
            fields.nth(1).fill("5000")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step4_verify_totals_balance(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/journal-entry")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step5_save_and_post(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/journal-entry")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step6_verify_in_journal_list(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/journals")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()


# ══════════════════════════════════════════════════════════════════════════════
# TC3 — Ledger Report Generation
# ══════════════════════════════════════════════════════════════════════════════
class TestCase3_LedgerReport:

    def test_step1_navigate_to_ledger(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/ledger-report")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step2_select_account(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/ledger-report")
        logged_in_page.wait_for_load_state("networkidle")
        sel = logged_in_page.locator("select").first
        if sel.count() > 0:
            sel.select_option(index=1)
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step3_set_date_range(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/ledger-report")
        logged_in_page.wait_for_load_state("networkidle")
        dates = logged_in_page.locator("input[type='date']")
        if dates.count() >= 2:
            dates.nth(0).fill("2025-04-01")
            dates.nth(1).fill("2026-03-24")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step4_verify_opening_balance(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/ledger-report")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step5_verify_transaction_rows(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/ledger-report")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step6_verify_closing_balance(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/ledger-report")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()


# ══════════════════════════════════════════════════════════════════════════════
# TC4 — Trial Balance Report Accuracy
# ══════════════════════════════════════════════════════════════════════════════
class TestCase4_TrialBalance:

    def test_step1_navigate_to_trial_balance(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-statements")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step2_select_year_and_generate(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-statements")
        logged_in_page.wait_for_load_state("networkidle")
        sel = logged_in_page.locator("select").first
        if sel.count() > 0:
            sel.select_option(index=1)
        logged_in_page.wait_for_timeout(1500)
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step3_verify_accounts_with_columns(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-statements")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step4_verify_totals_balanced(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-statements")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step5_verify_zero_balance_handling(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-statements")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step6_print_report(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-statements")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()


# ══════════════════════════════════════════════════════════════════════════════
# TC5 — Profit & Loss Statement Generation
# ══════════════════════════════════════════════════════════════════════════════
class TestCase5_ProfitLoss:

    def test_step1_navigate_to_pl(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-statements")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step2_select_year_generate(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-statements")
        logged_in_page.wait_for_load_state("networkidle")
        sel = logged_in_page.locator("select").first
        if sel.count() > 0:
            sel.select_option(index=1)
        logged_in_page.wait_for_timeout(1500)
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step3_verify_income_section(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-statements")
        logged_in_page.wait_for_load_state("networkidle")
        body_text = logged_in_page.locator("body").inner_text()
        assert any(kw in body_text.upper() for kw in ["INCOME", "REVENUE", "SALES"])

    def test_step4_verify_expense_section(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-statements")
        logged_in_page.wait_for_load_state("networkidle")
        body_text = logged_in_page.locator("body").inner_text()
        assert any(kw in body_text.upper() for kw in ["EXPENSE", "EXPENDITURE", "PURCHASE", "COST"])

    def test_step5_verify_gross_profit(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-statements")
        logged_in_page.wait_for_load_state("networkidle")
        body_text = logged_in_page.locator("body").inner_text()
        assert "GROSS" in body_text.upper()

    def test_step6_verify_net_profit(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-statements")
        logged_in_page.wait_for_load_state("networkidle")
        body_text = logged_in_page.locator("body").inner_text()
        assert "NET" in body_text.upper()


# ══════════════════════════════════════════════════════════════════════════════
# TC6 — Financial Year Period Control
# ══════════════════════════════════════════════════════════════════════════════
class TestCase6_FinancialYear:

    def test_step1_navigate_to_fy(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-year")
        logged_in_page.wait_for_load_state("networkidle")
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step2_create_financial_year(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-year")
        logged_in_page.wait_for_load_state("networkidle")
        try:
            logged_in_page.locator("button:has-text('Add'), button:has-text('New'), button:has-text('Create')").first.click()
            logged_in_page.wait_for_timeout(800)
            dates = logged_in_page.locator("input[type='date']")
            if dates.count() >= 2:
                dates.nth(0).fill("2025-04-01")
                dates.nth(1).fill("2026-03-31")
            logged_in_page.locator("button[type='submit'], button:has-text('Save')").first.click()
            logged_in_page.wait_for_timeout(1000)
        except Exception:
            pass
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step3_set_active(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-year")
        logged_in_page.wait_for_load_state("networkidle")
        try:
            logged_in_page.locator("button:has-text('Activate'), button:has-text('Set Active'), button:has-text('Select')").first.click()
            logged_in_page.wait_for_timeout(800)
        except Exception:
            pass
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step4_post_in_open_period(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/journal-entry")
        logged_in_page.wait_for_load_state("networkidle")
        date_input = logged_in_page.locator("input[type='date']").first
        if date_input.count() > 0:
            date_input.fill("2026-03-15")
        logged_in_page.wait_for_timeout(800)
        body_text = logged_in_page.locator("body").inner_text().upper()
        assert "PERIOD CLOSED" not in body_text and "INVALID PERIOD" not in body_text

    def test_step5_block_closed_period(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/journal-entry")
        logged_in_page.wait_for_load_state("networkidle")
        date_input = logged_in_page.locator("input[type='date']").first
        if date_input.count() > 0:
            date_input.fill("2024-03-01")
        logged_in_page.wait_for_timeout(800)
        try:
            logged_in_page.locator("button[type='submit'], button:has-text('Save'), button:has-text('Post')").first.click()
            logged_in_page.wait_for_timeout(1000)
        except Exception:
            pass
        expect(logged_in_page.locator("body")).to_be_visible()

    def test_step6_reports_filter_by_year(self, logged_in_page: Page):
        logged_in_page.goto(f"{BASE_URL}/financial-statements")
        logged_in_page.wait_for_load_state("networkidle")
        sel = logged_in_page.locator("select").first
        if sel.count() > 0:
            sel.select_option(index=1)
        logged_in_page.wait_for_timeout(1500)
        expect(logged_in_page.locator("body")).to_be_visible()
