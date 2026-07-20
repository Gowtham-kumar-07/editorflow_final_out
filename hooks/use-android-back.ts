'use client'

import { useEffect } from 'react'

/**
 * Handles the Android hardware / gesture back button.
 *
 * The native WebView shell fires the cancelable 'editorflow:backpress' DOM
 * event before acting on the back press. Calling event.preventDefault() tells
 * the shell that the web layer handled it; otherwise the shell calls
 * webView.goBack() or finish().
 */
export function useAndroidBack(isSearchOpen: boolean, closeSearch: () => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      // 1. Close command palette if it is open
      if (isSearchOpen) {
        e.preventDefault()
        closeSearch()
        return
      }

      // 2. Dismiss any open Radix dialog / sheet via synthetic Escape keydown
      const openOverlay = document.querySelector<Element>(
        '[role="dialog"][data-state="open"], ' +
          '[role="alertdialog"][data-state="open"], ' +
          '[data-radix-popper-content-wrapper]',
      )
      if (openOverlay) {
        e.preventDefault()
        document.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
            keyCode: 27,
            bubbles: true,
            cancelable: true,
          }),
        )
        return
      }

      // 3. Nothing to handle — shell falls back to webView.goBack() / finish()
    }

    document.addEventListener('editorflow:backpress', handler)
    return () => document.removeEventListener('editorflow:backpress', handler)
  }, [isSearchOpen, closeSearch])
}
