// =============================================================================
// ドヤスライド - Google Slides 作成
// サービスアカウントでスライド作成 → ユーザーに編集権限付与
// =============================================================================
import { getServiceAccountAccessToken } from './googleServiceAccount'
import type { SlideSpec, SlideElementSpec } from './types'

const SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive',
]

async function createSlidePresentation(title: string) {
  const token = await getServiceAccountAccessToken(SCOPES)
  const res = await fetch('https://slides.googleapis.com/v1/presentations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Slides create error: ${res.status} - ${t.substring(0, 800)}`)
  }
  return (await res.json()) as { presentationId: string; slides: any[] }
}

async function batchUpdate(presentationId: string, requests: any[]) {
  if (requests.length === 0) return
  const token = await getServiceAccountAccessToken(SCOPES)
  const res = await fetch(
    `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    }
  )
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Slides batchUpdate error: ${res.status} - ${t.substring(0, 800)}`)
  }
}

async function shareWithUser(presentationId: string, email: string) {
  const token = await getServiceAccountAccessToken(SCOPES)
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${presentationId}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'user',
        role: 'writer',
        emailAddress: email,
      }),
    }
  )
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Drive permissions error: ${res.status} - ${t.substring(0, 600)}`)
  }
}

// Google Slides の単位はEMU（914400 EMU = 1 inch）
const PT_TO_EMU = 12700 // 1pt = 12700 EMU

/**
 * 16:9 スライド（720pt x 405pt）を想定
 */
const SLIDE_WIDTH_PT = 720
const SLIDE_HEIGHT_PT = 405

function toEmu(pt: number): number {
  return Math.round(pt * PT_TO_EMU)
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) / 255
  const g = parseInt(h.substring(2, 4), 16) / 255
  const b = parseInt(h.substring(4, 6), 16) / 255
  return { red: r, green: g, blue: b }
}

function buildSlideRequests(slides: SlideSpec[], themeColor: string) {
  const requests: any[] = []
  const colorRgb = hexToRgb(themeColor)

  // デフォルトスライド(ID "p")は削除して使う
  requests.push({ deleteObject: { objectId: 'p' } })

  slides.forEach((slide, idx) => {
    const pageId = `slide_${idx}`
    requests.push({
      createSlide: {
        objectId: pageId,
        insertionIndex: idx,
      },
    })

    // 背景色
    requests.push({
      updatePageProperties: {
        objectId: pageId,
        fields: 'pageBackgroundFill.solidFill.color',
        pageProperties: {
          pageBackgroundFill: {
            solidFill: {
              color: { rgbColor: { red: 1, green: 1, blue: 1 } },
            },
          },
        },
      },
    })

    // タイトル
    const titleId = `${pageId}_title`
    requests.push({
      createShape: {
        objectId: titleId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: pageId,
          size: {
            width: { magnitude: toEmu(SLIDE_WIDTH_PT - 80), unit: 'EMU' },
            height: { magnitude: toEmu(50), unit: 'EMU' },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: toEmu(40),
            translateY: toEmu(24),
            unit: 'EMU',
          },
        },
      },
    })
    requests.push({
      insertText: {
        objectId: titleId,
        text: slide.title,
      },
    })
    requests.push({
      updateTextStyle: {
        objectId: titleId,
        fields: 'foregroundColor,fontSize,bold',
        style: {
          foregroundColor: { opaqueColor: { rgbColor: colorRgb } },
          fontSize: { magnitude: 28, unit: 'PT' },
          bold: true,
        },
      },
    })

    // 各要素
    slide.elements.forEach((el, elIdx) => {
      const elId = `${pageId}_el_${elIdx}`
      if (el.type === 'text') {
        requests.push({
          createShape: {
            objectId: elId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
              pageObjectId: pageId,
              size: {
                width: { magnitude: toEmu(SLIDE_WIDTH_PT - 80), unit: 'EMU' },
                height: { magnitude: toEmu(260), unit: 'EMU' },
              },
              transform: {
                scaleX: 1,
                scaleY: 1,
                translateX: toEmu(40),
                translateY: toEmu(90),
                unit: 'EMU',
              },
            },
          },
        })
        requests.push({
          insertText: { objectId: elId, text: el.content },
        })
        requests.push({
          updateTextStyle: {
            objectId: elId,
            fields: 'fontSize,foregroundColor',
            style: {
              fontSize: { magnitude: 16, unit: 'PT' },
              foregroundColor: { opaqueColor: { rgbColor: { red: 0.2, green: 0.2, blue: 0.2 } } },
            },
          },
        })
      } else if (el.type === 'bullets') {
        requests.push({
          createShape: {
            objectId: elId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
              pageObjectId: pageId,
              size: {
                width: { magnitude: toEmu(SLIDE_WIDTH_PT - 100), unit: 'EMU' },
                height: { magnitude: toEmu(280), unit: 'EMU' },
              },
              transform: {
                scaleX: 1,
                scaleY: 1,
                translateX: toEmu(50),
                translateY: toEmu(90),
                unit: 'EMU',
              },
            },
          },
        })
        const bulletText = (el.items || []).map((b) => `• ${b}`).join('\n')
        requests.push({
          insertText: { objectId: elId, text: bulletText },
        })
        requests.push({
          updateTextStyle: {
            objectId: elId,
            fields: 'fontSize,foregroundColor',
            style: {
              fontSize: { magnitude: 18, unit: 'PT' },
              foregroundColor: { opaqueColor: { rgbColor: { red: 0.15, green: 0.15, blue: 0.15 } } },
            },
          },
        })
      }
    })
  })

  return requests
}

export async function createGoogleSlideFromSpec(
  title: string,
  slides: SlideSpec[],
  themeColor: string,
  recipientEmail: string
): Promise<{ presentationId: string; url: string }> {
  // 1. 空のプレゼン作成
  const pres = await createSlidePresentation(title)
  const presentationId = pres.presentationId

  // 2. スライド構成を batchUpdate
  const requests = buildSlideRequests(slides, themeColor)
  await batchUpdate(presentationId, requests)

  // 3. ユーザーに共有
  await shareWithUser(presentationId, recipientEmail)

  const url = `https://docs.google.com/presentation/d/${presentationId}/edit`
  return { presentationId, url }
}

