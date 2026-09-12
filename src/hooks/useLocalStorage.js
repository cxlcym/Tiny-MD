import { useState, useEffect } from 'react'

// options.debounce: defer writes to localStorage by N ms (for large values
// that would otherwise be serialized on every keystroke)
export function useLocalStorage(key, initialValue, options = {}) {
  const { debounce = 0 } = options

  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error('Error reading from localStorage:', error)
      return initialValue
    }
  })

  useEffect(() => {
    const write = () => {
      try {
        window.localStorage.setItem(key, JSON.stringify(storedValue))
      } catch (error) {
        console.error('Error writing to localStorage:', error)
      }
    }

    if (debounce > 0) {
      const timer = setTimeout(write, debounce)
      return () => clearTimeout(timer)
    }
    write()
  }, [key, storedValue, debounce])

  return [storedValue, setStoredValue]
}
