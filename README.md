# Sales Navigator

Build my product calculator and sales management system as a complete Lovable web app only.

Do not include Telegram bot.

Do not use Python, Flask, Railway, Render, Replit, VPS, or external backend hosting.

Use:

- React + TypeScript

- Tailwind CSS

- Supabase Auth

- Supabase Database

- Supabase Storage if needed

Main goal:

Create a full web-based admin dashboard for managing products, prices, customers, orders, sales, and reports.

Features:

1. Admin Login

- Email/password login

- Protected dashboard

- Admin profile

- Logout

2. Dashboard

- Total revenue

- Today revenue

- Total orders

- Pending orders

- Completed orders

- Total customers

- Recent orders

- Sales chart

- Product performance chart

3. Product Management

- Add product

- Edit product

- Delete product

- Product fields:
  - product name

  - diameter / size

  - price in KS

  - waiting time

  - stock status

  - category

  - note

4. Product Calculator

- Select product

- Enter quantity

- Auto calculate total price

- Show waiting time

- Add discount

- Add extra fee

- Final total

- Save calculation as order

5. Order Management

- Create order

- Edit order

- Delete order

- Order status:
  - Pending

  - Paid

  - Processing

  - Completed

  - Cancelled

- Customer name

- Phone number

- Product items

- Quantity

- Total amount

- Payment status

- Order date

- Delivery / pickup note

6. Customer Management

- Add customer

- Edit customer

- Delete customer

- Customer fields:
  - name

  - phone

  - address

  - note

  - order history

  - total spent

7. Sales Report

- Daily sales

- Weekly sales

- Monthly sales

- Date filter

- Export CSV

- Best selling products

- Revenue summary

8. Search & Filter

- Search products by name, size, category

- Search orders by customer name or phone

- Filter orders by status

- Filter sales by date

9. Settings

- Business name

- Currency = KS

- Default waiting time

- Tax / service fee option

- Admin account settings

10. UI Design

- Modern SaaS dashboard

- Mobile responsive

- Dark mode

- Clean sidebar

- Cards, tables, modals

- Myanmar language friendly

- KS currency formatting

11. Database

Create Supabase tables:

- profiles

- products

- customers

- orders

- order_items

- settings

Add proper Row Level Security policies.

12. Important

Everything must work inside Lovable + Supabase only.

No Telegram bot.

No external backend.

No Python code.

Make it production-ready and easy to use.

Given File is just reference

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mycasegadgetstore.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ca664de1-c445-4e28-b093-9122433f6d63).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Production checks

Before deploying, run the complete local quality gate:

```sh
npm ci
npm run check
```

`check` runs TypeScript validation, ESLint, and the production build. Copy
`.env.example` to `.env.local` for local development and provide the Supabase
public URL and publishable key through the hosting provider's environment
settings. Never commit `.env`, service-role keys, or database passwords.

Database changes live in `supabase/migrations` and are applied by Lovable Cloud
when the project is synchronized. The production hardening migration adds
non-negative financial/inventory constraints, workflow-state validation, and
indexes for the most frequently used order and catalog queries.
