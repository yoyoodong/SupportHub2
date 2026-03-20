/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum QACategory {
  CORE_FEATURES = '核心功能',
  APPEARANCE = '外观相关',
  AFTER_SALES = '售后与排查',
  ART_CONTENT = '艺术内容与版权',
  PRE_SALES = '售前与硬件',
  OTHER = '其他',
}

export enum FeedbackChannel {
  XHS = '小红书',
  DY = '抖音',
  WX = '微信',
  EC = '电商',
}

export enum FeedbackStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
}

export interface QAEntry {
  recordId?: string;
  id: string;
  category: QACategory;
  question: string;
  script: string;
  notes: string;
  updated_at: number;
}

export interface FeedbackEntry {
  recordId?: string;
  id: string;
  user_voice: string;
  category: QACategory;
  channel: FeedbackChannel;
  image_urls: string[];
  status: FeedbackStatus;
  submitter: string;
  created_at: number;
}
