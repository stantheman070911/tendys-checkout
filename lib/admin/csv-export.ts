export function getCsvExportErrorMessage(status: number): string {
  if (status === 401) {
    return "登入已過期，請重新登入後再試一次";
  }

  if (status === 400) {
    return "匯出參數錯誤，請重新整理後再試一次";
  }

  return "匯出失敗，請稍後再試";
}
