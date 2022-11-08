const cleanText = s => s.trim().replace(/\s\s+/g, ' ')

class Scraper {
  constructor() {
    this.rewriter = new HTMLRewriter()
    return this
  }

  async fetch(url) {
    this.url = url
    this.response = await fetch(url,headers: {
        'authority': 'www.google.com',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6,zh-TW;q=0.5',
        'cache-control': 'no-cache',
         'pragma': 'no-cache',
        'referer': 'https://www.google.com/',
        'sec-ch-ua': '"Microsoft Edge";v="107", "Chromium";v="107", "Not=A?Brand";v="24"',
        'sec-ch-ua-arch': '""',
        'sec-ch-ua-bitness': '"64"',
        'sec-ch-ua-full-version': '"107.0.1418.35"',
        'sec-ch-ua-full-version-list': '"Microsoft Edge";v="107.0.1418.35", "Chromium";v="107.0.5304.90", "Not=A?Brand";v="24.0.0.0"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-model': '"Nexus 5"',
        'sec-ch-ua-platform': '"Android"',
        'sec-ch-ua-platform-version': '"6.0"',
        'sec-ch-ua-wow64': '?0',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Mobile Safari/537.36 Edg/107.0.1418.35'
    })

    const server = this.response.headers.get('server')

    const isThisWorkerErrorNotErrorWithinScrapedSite = (
      [530, 503, 502, 403, 400].includes(this.response.status) &&
      (server === 'cloudflare' || !server /* Workers preview editor */)
    )

    if (isThisWorkerErrorNotErrorWithinScrapedSite) {
      throw new Error(`Status ${ this.response.status } requesting ${ url }`)
    }

    return this
  }

  querySelector(selector) {
    this.selector = selector
    return this
  }

  async getText({ spaced }) {
    const matches = {}
    const selectors = new Set(this.selector.split(',').map(s => s.trim()))

    selectors.forEach((selector) => {
      matches[selector] = []

      let nextText = ''

      this.rewriter.on(selector, {
        element(element) {
          matches[selector].push(true)
          nextText = ''
        },

        text(text) {
          nextText += text.text

          if (text.lastInTextNode) {
            if (spaced) nextText += ' '
            matches[selector].push(nextText)
            nextText = ''
          }
        }
      })
    })

    const transformed = this.rewriter.transform(this.response)

    await transformed.arrayBuffer()

    selectors.forEach((selector) => {
      const nodeCompleteTexts = []

      let nextText = ''

      matches[selector].forEach(text => {
        if (text === true) {
          if (nextText.trim() !== '') {
            nodeCompleteTexts.push(cleanText(nextText))
            nextText = ''
          }
        } else {
          nextText += text
        }
      })

      const lastText = cleanText(nextText)
      if (lastText !== '') nodeCompleteTexts.push(lastText)
      matches[selector] = nodeCompleteTexts
    })

    return selectors.length === 1 ? matches[selectors[0]] : matches
  }

  async getAttribute(attribute) {
    class AttributeScraper {
      constructor(attr) {
        this.attr = attr
      }

      element(element) {
        if (this.value) return

        this.value = element.getAttribute(this.attr)
      }
    }

    const scraper = new AttributeScraper(attribute)

    await new HTMLRewriter().on(this.selector, scraper).transform(this.response).arrayBuffer()

    return scraper.value || ''
  }
}

export default Scraper
