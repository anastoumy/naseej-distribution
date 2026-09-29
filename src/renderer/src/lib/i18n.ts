import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../../content/en.json'
import ar from '../../content/ar.json'

const savedLanguage = localStorage.getItem('naseej-language') || 'ar'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar }
  },
  lng: savedLanguage,
  fallbackLng: 'en',
  supportedLngs: ['ar', 'en'],
  load: 'languageOnly',
  interpolation: {
    escapeValue: false
  }
})

function applyDocumentLanguage(lang: string) {
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
}

applyDocumentLanguage(savedLanguage)

i18n.on('languageChanged', (lang) => {
  applyDocumentLanguage(lang)
  localStorage.setItem('naseej-language', lang)
})

export default i18n
