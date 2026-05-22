'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Spin } from 'antd';
import {
  TrophyOutlined,
  RocketOutlined,
  HeartOutlined,
  CalendarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  StarOutlined,
  BulbOutlined,
  ToolOutlined,
  ArrowRightOutlined,
  CrownOutlined,
  FireOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import type { Event } from '@/types';

export default function CompetitionsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      try {
        const { data, error } = await getSupabase()
          .from('events')
          .select('*')
          .order('start_time', { ascending: false });
        if (error) throw error;
        setEvents((data ?? []) as Event[]);
      } catch (err) {
        console.error('Failed to fetch events:', err);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  const ongoingEvents = events.filter((e) => e.status === 'ongoing');
  const currentEvent = ongoingEvents[0];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* ═══ 1. 当前进行中赛事 Banner ═══ */}
      <section className="mb-10 animate-fade-up">
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-10"
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #1a3a8a 70%, #F27F22 100%)',
            boxShadow: '0 12px 40px rgba(26,58,138,0.35)',
          }}>
          {/* Decorative orbs */}
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, rgba(242,127,34,0.6), transparent 70%)', transform: 'translate(20%, -30%)' }} />
          <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(100,200,255,0.5), transparent 70%)', transform: 'translate(-20%, 30%)' }} />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-green-400" style={{ animation: 'pulse 2s infinite' }} />
              <span className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
                <TrophyOutlined className="mr-1" />5 月大赛进行中
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 leading-tight">
              HRAS · AI<span style={{ color: '#F27F22' }}>"智"</span>造赛
            </h1>
            <p className="text-lg sm:text-xl font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
              AI 重构效率，创意定义价值
            </p>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
              "AI 浪潮势不可挡，HRAS 全员乘势而上"
            </p>

            {/* Stats */}
            <div className="flex flex-wrap gap-3 mb-6">
              {[
                { icon: <BulbOutlined />, label: '赛事目标', value: '提效降本 · 创新破局 · 共创共享' },
                { icon: <TeamOutlined />, label: '覆盖人群', value: 'HRAS 全体（ZT + GF + WX）' },
                { icon: <CalendarOutlined />, label: '提报时间', value: '每月 1-25 日滚动报名' },
                { icon: <ClockCircleOutlined />, label: '赛事节奏', value: '每月 25 日截止 / 次月 1 日公布' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/90 text-xs"
                  style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)' }}>
                  <span className="text-white/70">{item.icon}</span>
                  <span><span className="font-medium text-white/60">{item.label}：</span>{item.value}</span>
                </div>
              ))}
            </div>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3">
              {currentEvent ? (
                <Link href={`/competitions/${currentEvent.id}`}>
                  <button className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all hover:scale-105 hover:shadow-lg"
                    style={{ background: '#fff', color: '#1a3a8a' }}>
                    <RocketOutlined /> 立即提报
                  </button>
                </Link>
              ) : (
                <button className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all hover:scale-105"
                  style={{ background: '#fff', color: '#1a3a8a' }}>
                  <RocketOutlined /> 立即提报
                </button>
              )}
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}
                onClick={() => document.getElementById('track-section')?.scrollIntoView({ behavior: 'smooth' })}>
                <ThunderboltOutlined /> 了解双赛道
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 2. AI 赛事介绍 ═══ */}

      {/* Dual Tracks */}
      <section id="track-section" className="mb-10">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">
            <span style={{ color: 'var(--primary)' }}>"降本"</span> + <span style={{ color: 'var(--accent)' }}>"增值"</span> 双赛道
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>总有一款适合你 · 每人可提报方案数不限</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Track A */}
          <div className="glass rounded-2xl p-6 sm:p-7 group hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{ background: 'linear-gradient(135deg, #1a3a8a, #4a6fc7)', color: '#fff', boxShadow: '0 4px 15px rgba(26,58,138,0.3)' }}>
                A
              </span>
              <div>
                <div className="text-base font-bold" style={{ color: 'var(--foreground)' }}>降本提效赛道</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>已有场景 · 替代或简化已有流程</div>
              </div>
            </div>
            <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              用 AI <strong>替代或简化已有流程</strong>——现在做的事，用 AI 做得更快、更准、更省。
            </p>
            <div className="p-3 rounded-lg mb-4" style={{ background: 'rgba(26,58,138,0.04)' }}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>月度评分公式</div>
              <div className="text-xs" style={{ color: 'var(--text-primary)' }}>月度有效节省工时 = 个人月节省工时 × 实际复用人数</div>
            </div>
            <div className="space-y-2">
              {['薪酬核算自动化 — 月省 90H / 100% 准确率', '发票核对与报账 — 月省 260H / 99.5% 准确', '数据报表生成 — 月省 30H / 12 份/月', '招聘简历筛选 — 月省 80H'].map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <CheckCircleOutlined className="mt-0.5 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Track B */}
          <div className="glass rounded-2xl p-6 sm:p-7 group hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{ background: 'linear-gradient(135deg, #F27F22, #e8650a)', color: '#fff', boxShadow: '0 4px 15px rgba(242,127,34,0.3)' }}>
                B
              </span>
              <div>
                <div className="text-base font-bold" style={{ color: 'var(--foreground)' }}>增值创新赛道</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>新场景 · 创造新体验、新关怀、新能力</div>
              </div>
            </div>
            <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              用 AI <strong>创造新体验、新关怀、新能力</strong>——原本没有的事，用 AI 让它从 0 到 1。
            </p>
            <div className="p-3 rounded-lg mb-4" style={{ background: 'rgba(242,127,34,0.04)' }}>
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>月度评分公式</div>
              <div className="text-xs" style={{ color: 'var(--text-primary)' }}>月度有效覆盖人次 = 受益员工人数 × 应用频次 × 满意度系数</div>
            </div>
            <div className="space-y-2">
              {['全员生日自动祝福 — 满意度 92% / 打开率 85%', '离职预警看板 — 准确率 75% / 挽留 12 人/季', '文化活动智能推送 — 参与率 +33pt', '海外员工关怀 — 触达 100% / 满意度 85%'].map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <CheckCircleOutlined className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="mb-10">
        <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <CalendarOutlined style={{ color: 'var(--primary)' }} />
            赛事时间
          </h2>
          <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>每月滚动进行，持续开放</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { time: '随时', stage: '许愿池提报', desc: '全员可随时提交工作痛点', color: '#8b5cf6' },
              { time: '每月 1-25 日', stage: '方案提报', desc: '全员可随时提交参赛方案', color: 'var(--primary)' },
              { time: '每月 26-月底', stage: '组委会评审', desc: '集中评审当月所有方案', color: 'var(--accent)' },
              { time: '次月 1 日', stage: '公布结果', desc: '公布评审结果 + 发放激励', color: '#22c55e' },
            ].map((item) => (
              <div key={item.stage} className="p-4 rounded-xl text-center transition-all duration-300 hover:-translate-y-0.5"
                style={{ background: `${item.color}08`, border: `1px solid ${item.color}15` }}>
                <div className="text-xs font-semibold mb-1" style={{ color: item.color }}>{item.time}</div>
                <div className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)' }}>{item.stage}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Review + Awards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        {/* Review */}
        <div className="glass rounded-2xl p-6 sm:p-7" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <StarOutlined style={{ color: 'var(--primary)' }} />
            评审机制
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>组委会每月集中评审</p>
          <div className="space-y-3">
            {['评估方案价值与可行性', '审核方案数据真实性', '确定评分并公布结果'].map((item) => (
              <div key={item} className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(26,58,138,0.1)', color: 'var(--primary)' }}>✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Awards */}
        <div className="glass rounded-2xl p-6 sm:p-7" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <CrownOutlined style={{ color: 'var(--accent)' }} />
            参赛激励
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>现金奖励 + 小红花荣誉体系</p>
          <div className="space-y-3">
            {[
              { icon: <CrownOutlined />, name: '"智效闪电"奖 ×3', desc: '降本赛道 Top 3 · 现金 + 金银花', color: '#F27F22' },
              { icon: <FireOutlined />, name: '"智创先锋"奖 ×3', desc: '增值赛道 Top 3 · 现金 + 金银花', color: '#1a3a8a' },
              { icon: <ThunderboltOutlined />, name: '"灵感火花"奖 ×6', desc: '双赛道 4-10 名 · AI 会员 + 铜花', color: '#8b5cf6' },
              { icon: <HeartOutlined />, name: '"最具潜力"奖 ×6', desc: '创意出色 · 实物奖励 + 铜花', color: '#22c55e' },
            ].map((item) => (
              <div key={item.name} className="flex items-center gap-3 p-2.5 rounded-lg transition-all hover:shadow-sm"
                style={{ background: `${item.color}06` }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${item.color}12`, color: item.color }}>
                  {item.icon}
                </span>
                <div>
                  <div className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>{item.name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wishing Pool */}
      <section className="mb-10">
        <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <HeartOutlined style={{ color: '#8b5cf6' }} />
            AI 许愿池
          </h2>
          <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>你来许愿，AI 来实现</p>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-start">
            <div>
              <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                每个人的日常工作里，都有反复做、耗时长、易出错的痛点场景。把它告诉我们——组委会将从许愿中选出下期 AI 大赛主题。
              </p>
              <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
                <div className="text-xs font-medium mb-2" style={{ color: '#8b5cf6' }}>许愿格式建议</div>
                <div className="text-sm italic" style={{ color: 'var(--text-primary)' }}>
                  「我每次做 XX 要花 X 小时，如果 AI 能帮我 XX 就好了」
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {['重复劳动多', '流程耗时长', '数据易出错', '跨部门协作难', '信息查找慢'].map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-full text-xs" style={{ background: 'rgba(139,92,246,0.08)', color: '#8b5cf6' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-5 rounded-xl text-center" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
              <div className="text-3xl mb-2">✨</div>
              <div className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)' }}>你的愿望 = 下期赛题</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>被选中的愿望将获得<br />AI 方案优先支持</div>
            </div>
          </div>
        </div>
      </section>

      {/* Toolkit */}
      <section className="mb-10">
        <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <ToolOutlined style={{ color: 'var(--primary)' }} />
            参赛工具包
          </h2>
          <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>不知道从哪里开始？先看看 HSSC AI 公开课系列</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {['AI 工具入门', 'Prompt 工程', 'Agent · 智能体', '自动化工作流', '案例拆解'].map((tag) => (
              <span key={tag} className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(26,58,138,0.08)', color: 'var(--primary)' }}>
                {tag}
              </span>
            ))}
          </div>
          <Link href="/courses">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'var(--primary)' }}>
              <ArrowRightOutlined /> 进入课程主页
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
