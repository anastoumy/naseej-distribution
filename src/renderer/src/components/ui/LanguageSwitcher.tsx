import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en'
    i18n.changeLanguage(newLang)
    localStorage.setItem('naseej-language', newLang)
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = newLang
  }

  const isEnglish = i18n.language === 'en'

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
                 text-muted-foreground hover:text-foreground hover:bg-muted
                 transition-all duration-150 cursor-pointer"
      aria-label={isEnglish ? t('language.switchToArabic') : t('language.switchToEnglish')}
      title={isEnglish ? t('language.arabic') : t('language.english')}
    >
      <Languages size={14} />
      <span>{isEnglish ? 'AR' : 'EN'}</span>
    </button>
  )
}
