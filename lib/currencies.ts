export const SUPPORTED_CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar'           },
  { code: 'EUR', label: 'EUR — Euro'                },
  { code: 'GBP', label: 'GBP — British Pound'       },
  { code: 'INR', label: 'INR — Indian Rupee'        },
  { code: 'AUD', label: 'AUD — Australian Dollar'   },
  { code: 'CAD', label: 'CAD — Canadian Dollar'     },
  { code: 'SGD', label: 'SGD — Singapore Dollar'    },
  { code: 'AED', label: 'AED — UAE Dirham'          },
] as const

export type SupportedCurrencyCode = typeof SUPPORTED_CURRENCIES[number]['code']
