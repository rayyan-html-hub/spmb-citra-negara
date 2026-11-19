"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav aria-label="Navigasi halaman" className="flex items-center justify-center gap-2">
      <Button
        aria-label="Halaman sebelumnya"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        size="sm"
        variant="secondary"
      >
        <ChevronLeft aria-hidden="true" size={16} />
      </Button>
      {pages.map((number) => (
        <Button
          aria-current={page === number ? "page" : undefined}
          aria-label={`Halaman ${number}`}
          key={number}
          onClick={() => onPageChange(number)}
          size="sm"
          variant={page === number ? "primary" : "secondary"}
        >
          {number}
        </Button>
      ))}
      <Button
        aria-label="Halaman berikutnya"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        size="sm"
        variant="secondary"
      >
        <ChevronRight aria-hidden="true" size={16} />
      </Button>
    </nav>
  );
}
