/**
 * 银行卡品牌识别工具
 * 根据卡号前缀（IIN/BIN）识别卡品牌
 */

export interface CardBrand {
  name: string;
  pattern: RegExp;
  lengths: number[];
}

// 主流卡品牌规则
const CARD_BRANDS: CardBrand[] = [
  {
    name: 'Visa',
    pattern: /^4/,
    lengths: [13, 16, 19],
  },
  {
    name: 'Mastercard',
    pattern: /^(5[1-5]|2[2-7])/,
    lengths: [16],
  },
  {
    name: 'American Express',
    pattern: /^3[47]/,
    lengths: [15],
  },
  {
    name: 'Discover',
    pattern: /^(6011|622126|622127|622128|622129|62213|62214|62215|62216|62217|62218|62219|6222[0-9]|6229[01]|644|645|646|647|648|649|65)/,
    lengths: [16, 19],
  },
  {
    name: 'JCB',
    pattern: /^35(2[89]|[3-8][0-9])/,
    lengths: [16, 19],
  },
  {
    name: 'UnionPay',
    pattern: /^62/,
    lengths: [16, 17, 18, 19],
  },
  {
    name: 'Diners Club',
    pattern: /^(36|38|30[0-5])/,
    lengths: [14, 16],
  },
  {
    name: 'Maestro',
    pattern: /^(5018|5020|5038|5893|6304|6759|6761|6762|6763)/,
    lengths: [12, 13, 14, 15, 16, 17, 18, 19],
  },
];

/**
 * 识别银行卡品牌
 * @param cardNumber 卡号（可带空格或其他分隔符）
 * @returns 品牌名称，未识别返回空字符串
 */
export function detectCardBrand(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '');
  
  if (!digits || digits.length < 4) {
    return '';
  }

  for (const brand of CARD_BRANDS) {
    if (brand.pattern.test(digits)) {
      return brand.name;
    }
  }

  return '';
}

/**
 * Luhn 校验算法（模 10 校验）
 * 用于验证卡号格式是否合法
 * @param cardNumber 卡号（可带空格或其他分隔符）
 * @returns 是否通过校验
 */
export function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  
  if (!digits || digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  // 从右向左遍历
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * 获取卡品牌的建议长度
 * @param brand 品牌名称
 * @returns 该品牌常见的卡号长度数组
 */
export function getCardLengths(brand: string): number[] {
  const cardBrand = CARD_BRANDS.find(b => b.name === brand);
  return cardBrand?.lengths || [16];
}

/**
 * 验证卡号是否符合品牌规则
 * @param cardNumber 卡号
 * @param brand 品牌名称
 * @returns 是否匹配
 */
export function validateCardBrand(cardNumber: string, brand: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  const detectedBrand = detectCardBrand(digits);
  return detectedBrand === brand;
}
