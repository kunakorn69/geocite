"use client";

import { useEffect, useState } from "react";
import { Trash2, FileText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getUserPosts, deletePost } from "@/lib/firestore/posts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PostDoc } from "@/types";

export default function PostsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserPosts(user.uid)
      .then((data) => setPosts(data.sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as { seconds: number }).seconds * 1000;
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as { seconds: number }).seconds * 1000;
        return bTime - aTime;
      })))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleDelete(postId: string) {
    setDeletingId(postId);
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Posts</h2>
        <p className="text-muted-foreground">All the blog posts you have generated.</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading posts…</p>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No posts yet. Generate your first one from the Dashboard.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">{post.title}</CardTitle>
                  <CardDescription>
                    {post.createdAt instanceof Date
                      ? post.createdAt.toLocaleDateString()
                      : new Date((post.createdAt as { seconds: number }).seconds * 1000).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(post.id)}
                  disabled={deletingId === post.id}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-3 text-sm text-muted-foreground whitespace-pre-wrap">
                  {post.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
