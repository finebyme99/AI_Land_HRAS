import { redirect } from 'next/navigation';

// 案例由管理员统一发布，不开放全员投稿
export default function CreateCasePage() {
  redirect('/cases');
}
