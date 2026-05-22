'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Spin } from 'antd';
import {
  TrophyOutlined,
  RocketOutlined,
  HeartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  StarOutlined,
  BulbOutlined,
  ToolOutlined,
  ArrowRightOutlined,
  CrownOutlined,
  FireOutlined,
  ThunderboltOutlined,
  ArrowUpOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import type { Event } from '@/types';

export default function CompetitionsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTop, setShowTop] = useState(false);

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

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const ongoingEvents = events.filter((e) => e.status === 'ongoing');
  const currentEvent = ongoingEvents[0];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* ═══ 1. 顶部 Banner ═══ */}
      <section className="mb-10 animate-fade-up">
        <div className="relative overflow-hidden rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #12255a 0%, #1a3a8a 40%, #2a5298 70%, #3b6db5 100%)',
            boxShadow: '0 16px 48px rgba(10,14,39,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}>
          {/* Gradient mesh */}
          <div className="absolute inset-0 opacity-25"
            style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(242,127,34,0.4), transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(100,180,255,0.2), transparent 50%)' }} />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

          <div className="relative z-10 p-6 sm:p-10">
            {/* 胶囊导航 — 居中 */}
            <nav className="flex justify-center mb-8 sm:mb-10">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                {[
                  { label: '参赛说明', href: '#track-section' },
                  { label: '赛事时间', href: '#timeline-section' },
                  { label: '评审机制', href: '#review-section' },
                  { label: '参赛激励', href: '#awards-section' },
                  { label: '许愿池', href: '#wish-section' },
                  { label: '工具包', href: '#toolkit-section' },
                ].map((item) => (
                  <a key={item.label} href={item.href}
                    className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:bg-white/10"
                    style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {item.label}
                  </a>
                ))}
              </div>
            </nav>

            {/* Hero */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>5月大赛进行中</span>
                </div>

                <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-[1.1] tracking-tight">
                  AI 重构效率<br />
                  <span style={{ background: 'linear-gradient(90deg, #F27F22, #fbbf24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    创意定义价值
                  </span>
                </h1>
                <p className="text-sm mb-8 max-w-md" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  "我来执行，我创造 + 我定义如何执行 + AI 执行"——用 AI 解决 HR 实际场景问题
                </p>

                {/* 快捷按钮 */}
                <div className="flex flex-wrap gap-3">
                  <a href="https://ztn.feishu.cn/share/base/form/shrcn2OaxMFequUyz2E6VkJFvJg" target="_blank" rel="noopener noreferrer">
                    <button className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105 hover:shadow-xl"
                      style={{ background: '#fff', color: '#1a3a8a', boxShadow: '0 4px 24px rgba(255,255,255,0.15)' }}>
                      <RocketOutlined /> 参与提报
                    </button>
                  </a>
                  <a href="https://ztn.feishu.cn/share/base/form/shrcnzQxxexe7eyuztTiCydTdz7" target="_blank" rel="noopener noreferrer">
                    <button className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                      style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
                      <HeartOutlined /> 许下心愿
                    </button>
                  </a>
                  <button className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                    style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}
                    onClick={() => document.getElementById('track-section')?.scrollIntoView({ behavior: 'smooth' })}>
                    <ThunderboltOutlined /> 了解双赛道
                  </button>
                </div>
              </div>

              {/* 右侧信息卡 */}
              <div className="hidden lg:block space-y-2.5">
                {[
                  { label: '赛事目标', value: '鼓励全员 AI 落地实际工作场景', sub: '提效降本 · 创新破局 · 共创共享' },
                  { label: '覆盖人群', value: 'HRAS 全体', sub: 'ZT + GF + WX' },
                  { label: '提报时间', value: '每月 1-25 日', sub: '滚动报名，不限月份' },
                  { label: '赛事节奏', value: '每月 25 日截止', sub: '次月 1 日公布上月结果' },
                ].map((item) => (
                  <div key={item.label} className="p-3.5 rounded-xl transition-all duration-300 hover:translate-x-1"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.label}</div>
                    <div className="text-sm font-bold text-white mb-0.5">{item.value}</div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 双赛道 ═══ */}
      <section id="track-section" className="mb-10">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">
            <span style={{ color: 'var(--primary)' }}>"降本"</span> + <span style={{ color: 'var(--accent)' }}>"增值"</span> 双赛道
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>总有一款适合你 · 每人可提报方案数不限</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Track A */}
          <div className="glass rounded-2xl p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{ background: 'linear-gradient(135deg, #1a3a8a, #4a6fc7)', color: '#fff', boxShadow: '0 4px 15px rgba(26,58,138,0.3)' }}>A</span>
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
          <div className="glass rounded-2xl p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{ background: 'linear-gradient(135deg, #F27F22, #e8650a)', color: '#fff', boxShadow: '0 4px 15px rgba(242,127,34,0.3)' }}>B</span>
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

      {/* ═══ 赛事时间 ═══ */}
      <section id="timeline-section" className="mb-10">
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

      {/* ═══ 评审 + 激励 ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        <div id="review-section" className="glass rounded-2xl p-6 sm:p-7" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <StarOutlined style={{ color: 'var(--primary)' }} /> 评审机制
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

        <div id="awards-section" className="glass rounded-2xl p-6 sm:p-7" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <CrownOutlined style={{ color: 'var(--accent)' }} /> 参赛激励
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
                  style={{ background: `${item.color}12`, color: item.color }}>{item.icon}</span>
                <div>
                  <div className="text-xs font-bold" style={{ color: 'var(--foreground)' }}>{item.name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ AI 许愿池 ═══ */}
      <section id="wish-section" className="mb-10">
        <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <HeartOutlined style={{ color: '#8b5cf6' }} /> AI 许愿池
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
              <div className="flex flex-wrap gap-2 mb-5">
                {['重复劳动多', '流程耗时长', '数据易出错', '跨部门协作难', '信息查找慢'].map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-full text-xs" style={{ background: 'rgba(139,92,246,0.08)', color: '#8b5cf6' }}>
                    {tag}
                  </span>
                ))}
              </div>
              <a href="https://ztn.feishu.cn/share/base/form/shrcnzQxxexe7eyuztTiCydTdz7" target="_blank" rel="noopener noreferrer">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 20px rgba(124,58,237,0.25)' }}>
                  <SendOutlined /> 写下你的愿望
                </button>
              </a>
            </div>
            <div className="p-5 rounded-xl text-center" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.12)' }}>
              <div className="text-3xl mb-2">✨</div>
              <div className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)' }}>你的愿望 = 下期赛题</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>被选中的愿望将获得<br />AI 方案优先支持</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 参赛工具包 ═══ */}
      <section id="toolkit-section" className="mb-10">
        <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <ToolOutlined style={{ color: 'var(--primary)' }} /> 参赛工具包
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

      {/* ═══ 回到顶部 ═══ */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 w-11 h-11 rounded-full flex items-center justify-center text-white transition-all duration-300 z-50"
        style={{
          background: 'var(--gradient-primary)',
          boxShadow: 'var(--shadow-md)',
          opacity: showTop ? 1 : 0,
          transform: showTop ? 'translateY(0)' : 'translateY(20px)',
          pointerEvents: showTop ? 'auto' : 'none',
        }}>
        <ArrowUpOutlined />
      </button>
    </div>
  );
}
