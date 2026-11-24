import { Component } from 'react'
import { t } from '../../utils/i18n'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' }
  }

  componentDidCatch(error, info) {
    console.error('Tiny MD ErrorBoundary caught:', error, info)
  }

  handleRecover = () => {
    this.setState({ hasError: false, errorMessage: '' })
  }

  render() {
    if (this.state.hasError) {
      const lang = this.props.lang || 'en'
      return (
        <div style={{ padding: '24px', color: '#e53935', fontFamily: 'sans-serif' }}>
          <h2>{t('errorBoundaryTitle', lang)}</h2>
          <p>{this.state.errorMessage}</p>
          <button onClick={this.handleRecover} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            {t('errorBoundaryRecover', lang)}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
